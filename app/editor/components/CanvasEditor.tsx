"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function CanvasEditor() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [textSize, setTextSize] = useState(48);
  // Fixed style settings - not user changeable
  const lineHeight = 0.8; // Fixed line height
  const textRotation = -4; // Fixed rotation (slight angle)
  const textColor = "#c7f40c"; // Fixed neon green color
  const italicIntensity = -35; // Fixed italic intensity (negative = left skew)
  const [maskLoaded, setMaskLoaded] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  
  // Interactive text positioning and manipulation
  const [textX, setTextX] = useState<number | null>(null);
  const [textY, setTextY] = useState<number | null>(null);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartTextPos, setDragStartTextPos] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, size: 0 });
  const [textBounds, setTextBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const maskRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef({ isDragging: false, isTextSelected: false, dragStart: { x: 0, y: 0 }, dragStartTextPos: { x: 0, y: 0 } });
  const rafIdRef = useRef<number | null>(null);

  // Canvas dimensions - 9:16 ratio (portrait)
  const CANVAS_WIDTH = 540;
  const CANVAS_HEIGHT = 960; // 540 * 16/9 = 960

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImageUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setImageUrl(url || null);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background (white)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background image - cover mode: fill entire canvas, crop if needed
    if (imageUrl && imageRef.current) {
      const img = imageRef.current;
      
      // Calculate to cover entire canvas (no white gaps)
      const imgAspect = img.width / img.height;
      const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.width;
      let sourceHeight = img.height;

      if (imgAspect > canvasAspect) {
        // Image is wider - crop width to match canvas ratio
        sourceWidth = img.height * canvasAspect;
        sourceX = (img.width - sourceWidth) / 2;
      } else {
        // Image is taller - crop height to match canvas ratio
        sourceHeight = img.width / canvasAspect;
        sourceY = (img.height - sourceHeight) / 2;
      }

      // Draw image covering the entire canvas (540x960)
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight, // Source (cropped area)
        0, 0, CANVAS_WIDTH, CANVAS_HEIGHT // Destination (full canvas)
      );
    }

    // Draw text if available
    if (text.trim()) {
      ctx.save();
      
      // Set text properties with custom font
      const fontFamily = fontLoaded ? "FatFrank Heavy" : "Arial, sans-serif";
      ctx.font = `bold ${textSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      // Split text by newlines first (preserve user-entered line breaks)
      const userLines = text.split("\n");
      const lines: string[] = [];

      // Process each user-entered line (word wrap if needed)
      for (const userLine of userLines) {
        const words = userLine.trim().split(" ");
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > CANVAS_WIDTH * 5) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
      }

      // Use all lines (no limit)
      const displayLines = lines;
      
      // Use custom position if set, otherwise default to center
      const finalX = textX !== null ? textX : CANVAS_WIDTH / 2;
      const actualTextY = textY !== null ? textY : CANVAS_HEIGHT / 2;
      
      // Calculate font sizes: first line uses original size, second line matches width
      let firstLineWidth = 0;
      let secondLineFontSize = textSize;
      
      if (displayLines.length > 0) {
        // Measure first line width with original font size
        const firstLineMetrics = ctx.measureText(displayLines[0]);
        firstLineWidth = firstLineMetrics.width;
        
        // If there's a second line, calculate font size to match first line width
        if (displayLines.length > 1 && firstLineWidth > 0) {
          const secondLine = displayLines[1];
          // Measure second line with original font size
          const secondLineMetrics = ctx.measureText(secondLine);
          const secondLineWidth = secondLineMetrics.width;
          
          // Calculate scale factor to match widths
          if (secondLineWidth > 0) {
            const scaleFactor = firstLineWidth / secondLineWidth;
            secondLineFontSize = Math.max(12, Math.min(textSize, textSize * scaleFactor));
          }
        }
      }
      
      // Calculate total height with different line heights
      const firstLineHeight = textSize * lineHeight;
      const secondLineHeight = displayLines.length > 1 ? secondLineFontSize * lineHeight : firstLineHeight;
      const totalHeight = displayLines.length > 1 
        ? firstLineHeight + secondLineHeight + (displayLines.length - 2) * firstLineHeight
        : displayLines.length * firstLineHeight;
      
      const startY = actualTextY - (totalHeight - firstLineHeight) / 2;

      // Calculate text bounds for hit detection
      let maxWidth = firstLineWidth;
      displayLines.forEach((line, index) => {
        if (index === 0) {
          maxWidth = firstLineWidth;
        } else {
          // Use adjusted font size for measurement
          const tempFontSize = index === 1 ? secondLineFontSize : textSize;
          ctx.font = `bold ${tempFontSize}px ${fontFamily}`;
          const metrics = ctx.measureText(line);
          maxWidth = Math.max(maxWidth, metrics.width);
        }
      });
      
      // Reset font to original
      ctx.font = `bold ${textSize}px ${fontFamily}`;
      
      // Account for stroke width in bounds (shadow offset)
      const strokePadding = 15;
      const textBoundsX = finalX - maxWidth / 2 - strokePadding;
      const textBoundsY = startY - firstLineHeight / 2 - strokePadding / 2;
      const textBoundsWidth = maxWidth + strokePadding * 2;
      const textBoundsHeight = totalHeight + strokePadding;
      
      setTextBounds({
        x: textBoundsX,
        y: textBoundsY,
        width: textBoundsWidth,
        height: textBoundsHeight,
      });

      // Apply fixed rotation (always applied)
      ctx.save();
      // Convert degrees to radians
      const rotationRad = (textRotation * Math.PI) / 180;
      // Translate to center of text, rotate, then translate back
      ctx.translate(finalX, actualTextY);
      ctx.rotate(rotationRad);
      ctx.translate(-finalX, -actualTextY);

      // Apply italic skew transformation (intensity-based)
      // Convert intensity (-100 to 100) to skew angle in radians
      // 0 = no skew, positive = right skew, negative = left skew
      // Max ±15 degrees
      const skewAngle = (italicIntensity / 100) * (15 * Math.PI / 180);
      if (skewAngle !== 0) {
        ctx.transform(1, 0, Math.tan(skewAngle), 1, 0, 0);
      }

      // Draw each line with shadow and neon green fill (no white outline)
      let currentY = startY;
      displayLines.forEach((line, index) => {
        // Use adjusted font size for second line, original for others
        const lineFontSize = index === 1 && displayLines.length > 1 ? secondLineFontSize : textSize;
        const currentLineHeight = lineFontSize * lineHeight;
        
        // Set font size for this line
        ctx.font = `bold ${lineFontSize}px ${fontFamily}`;
        
        // Layer 1: Dark shadow (outermost, drawn on the left side)
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(8, lineFontSize * 0.2);
        ctx.strokeText(line, finalX - 4, currentY);
        
        // Layer 2: Neon green fill (main text)
        ctx.fillStyle = textColor; // #c7f40c
        ctx.fillText(line, finalX, currentY);
        
        // Move to next line position
        currentY += currentLineHeight;
      });

      // Restore rotation transform
      ctx.restore();

      // Draw selection box if text is selected
      if (isTextSelected && textBounds) {
        ctx.save();
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          textBounds.x,
          textBounds.y,
          textBounds.width,
          textBounds.height
        );
        
        // Draw resize handles
        const handleSize = 8;
        const handles = [
          { x: textBounds.x, y: textBounds.y }, // top-left
          { x: textBounds.x + textBounds.width, y: textBounds.y }, // top-right
          { x: textBounds.x, y: textBounds.y + textBounds.height }, // bottom-left
          { x: textBounds.x + textBounds.width, y: textBounds.y + textBounds.height }, // bottom-right
        ];
        
        ctx.fillStyle = "#3B82F6";
        ctx.setLineDash([]);
        handles.forEach((handle) => {
          ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        });
        
        ctx.restore();
      }

      ctx.restore();
    } else {
      setTextBounds(null);
    }

    // Draw watermark overlay on top of everything (always on top layer)
    if (maskRef.current) {
      ctx.save();
      // Draw watermark covering the entire canvas
      ctx.drawImage(maskRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
  }, [imageUrl, text, textSize, textX, textY, isTextSelected, fontLoaded]);

  // Load custom font on component mount
  useEffect(() => {
    const loadFont = async () => {
      try {
        const font = new FontFace(
          "FatFrank Heavy",
          `url(/fonnts.com-FatFrank_Heavy.otf)`
        );
        
        await font.load();
        document.fonts.add(font);
        setFontLoaded(true);
        console.log("Custom font loaded successfully");
        drawCanvas();
      } catch (error) {
        console.error("Failed to load custom font", error);
        setFontLoaded(false);
      }
    };
    
    loadFont();
  }, [drawCanvas]);

  // Load mask image on component mount
  useEffect(() => {
    const maskImg = new Image();
    maskImg.onload = () => {
      maskRef.current = maskImg;
      setMaskLoaded(true);
      console.log("Mask loaded successfully", maskImg.width, "x", maskImg.height);
      drawCanvas();
    };
    maskImg.onerror = (error) => {
      setMaskLoaded(false);
      console.error("Failed to load mask image from /mask.png", error);
    };
    maskImg.src = "/mask.png";
  }, [drawCanvas]);

  // Redraw canvas when image or text changes
  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageRef.current = img;
        drawCanvas();
      };
      img.onerror = () => {
        alert("Failed to load image");
        setImageUrl(null);
      };
      img.src = imageUrl;
    } else {
      drawCanvas();
    }
  }, [imageUrl, drawCanvas]);

  const handleGenerate = () => {
    drawCanvas();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create download link
    const link = document.createElement("a");
    link.download = "canvas-image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Get canvas coordinates from mouse event
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Check if point is inside text bounds
  const isPointInTextBounds = (x: number, y: number) => {
    if (!textBounds || !text.trim()) return false;
    return (
      x >= textBounds.x &&
      x <= textBounds.x + textBounds.width &&
      y >= textBounds.y &&
      y <= textBounds.y + textBounds.height
    );
  };

  // Check if point is on a resize handle
  const getResizeHandle = (x: number, y: number): string | null => {
    if (!textBounds || !isTextSelected) return null;
    
    const handleSize = 8;
    const handles = [
      { name: "nw", x: textBounds.x, y: textBounds.y },
      { name: "ne", x: textBounds.x + textBounds.width, y: textBounds.y },
      { name: "sw", x: textBounds.x, y: textBounds.y + textBounds.height },
      { name: "se", x: textBounds.x + textBounds.width, y: textBounds.y + textBounds.height },
    ];
    
    for (const handle of handles) {
      if (
        x >= handle.x - handleSize / 2 &&
        x <= handle.x + handleSize / 2 &&
        y >= handle.y - handleSize / 2 &&
        y <= handle.y + handleSize / 2
      ) {
        return handle.name;
      }
    }
    
    return null;
  };

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    const handle = getResizeHandle(coords.x, coords.y);
    
    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setResizeStart({ x: coords.x, y: coords.y, size: textSize });
    } else if (isPointInTextBounds(coords.x, coords.y)) {
      setIsTextSelected(true);
      setIsDragging(true);
      setDragStart({ x: coords.x, y: coords.y });
      
      // Store initial text position when dragging starts
      const currentX = textX !== null ? textX : CANVAS_WIDTH / 2;
      const currentY = textY !== null ? textY : CANVAS_HEIGHT / 2;
      const startPos = { x: currentX, y: currentY };
      setDragStartTextPos(startPos);
      
      // Update ref for window event handlers
      dragStateRef.current = {
        isDragging: true,
        isTextSelected: true,
        dragStart: { x: coords.x, y: coords.y },
        dragStartTextPos: startPos,
      };
    } else {
      setIsTextSelected(false);
    }
  };

  // Handle mouse move on canvas (for cursor updates)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(e);
    
    // Update cursor
    const handle = getResizeHandle(coords.x, coords.y);
    if (handle) {
      canvas.style.cursor = handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
    } else if (isPointInTextBounds(coords.x, coords.y)) {
      canvas.style.cursor = "move";
    } else {
      canvas.style.cursor = "default";
    }
    
    // Handle dragging/resizing if active
    handleDragOrResize(e);
  };

  // Handle drag or resize (works with window events too)
  const handleDragOrResize = (e: MouseEvent | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const coords = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    
    // Use ref for current drag state (always up to date)
    const dragState = dragStateRef.current;
    
    if (dragState.isDragging && dragState.isTextSelected) {
      const deltaX = coords.x - dragState.dragStart.x;
      const deltaY = coords.y - dragState.dragStart.y;
      
      // Calculate new position from initial position + delta
      const newX = dragState.dragStartTextPos.x + deltaX;
      const newY = dragState.dragStartTextPos.y + deltaY;
      
      // Update state immediately for responsiveness
      setTextX(newX);
      setTextY(newY);
      
      // Throttle canvas redraws using requestAnimationFrame
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          drawCanvas();
          rafIdRef.current = null;
        });
      }
    } else if (isResizing && resizeHandle) {
      const deltaX = coords.x - resizeStart.x;
      const deltaY = coords.y - resizeStart.y;
      const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
      
      let newSize = resizeStart.size;
      if (resizeHandle === "se" || resizeHandle === "ne") {
        newSize = Math.max(24, Math.min(120, resizeStart.size + delta * 0.5));
      } else {
        newSize = Math.max(24, Math.min(120, resizeStart.size - delta * 0.5));
      }
      
      setTextSize(Math.round(newSize));
      
      // Throttle canvas redraws using requestAnimationFrame
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          drawCanvas();
          rafIdRef.current = null;
        });
      }
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    dragStateRef.current = { isDragging: false, isTextSelected: false, dragStart: { x: 0, y: 0 }, dragStartTextPos: { x: 0, y: 0 } };
    
    // Cancel any pending animation frame and ensure final redraw
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Force final redraw to ensure canvas is up to date
    drawCanvas();
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "default";
    }
  };

  // Handle mouse leave (don't stop dragging, just reset cursor)
  const handleMouseLeave = () => {
    const canvas = canvasRef.current;
    if (canvas && !isDragging && !isResizing) {
      canvas.style.cursor = "default";
    }
  };

  // Add window-level mouse events for dragging outside canvas
  useEffect(() => {
    if (isDragging || isResizing) {
      const handleWindowMouseMove = (e: MouseEvent) => {
        handleDragOrResize(e);
      };
      
      const handleWindowMouseUp = () => {
        handleMouseUp();
      };
      
      window.addEventListener("mousemove", handleWindowMouseMove);
      window.addEventListener("mouseup", handleWindowMouseUp);
      
      return () => {
        window.removeEventListener("mousemove", handleWindowMouseMove);
        window.removeEventListener("mouseup", handleWindowMouseUp);
      };
    }
  }, [isDragging, isResizing]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Canvas Editor</h1>
        <p className="text-muted-foreground">
          Upload an image, add text, and download your creation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input Controls */}
        <div className="space-y-6">
          {/* Background Image Input */}
          <div className="space-y-2">
            <label htmlFor="image-input" className="block text-sm font-medium">
              Background Image
            </label>
            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-10 h-10 mb-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* URL Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="text-gray-500">OR</span>
                </div>
                  <input
                    type="url"
                    id="image-input"
                    value={imageUrl || ""}
                    onChange={handleUrlChange}
                    placeholder="Enter background image URL"
                    className="block w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
              </div>
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <label htmlFor="text-input" className="block text-sm font-medium">
              Text
            </label>
            <textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value.toUpperCase())}
              placeholder="Enter text to overlay on the image"
              rows={4}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Text Size */}
          <div className="space-y-2">
            <label htmlFor="text-size" className="block text-sm font-medium">
              Text Size: {textSize}px
            </label>
            <input
              type="range"
              id="text-size"
              min="24"
              max="120"
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Generate
          </button>
        </div>

        {/* Right Column - Canvas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Preview</h2>
              {maskLoaded && (
                <span className="text-xs text-green-600 dark:text-green-400" title="Mask is active">
                  🎭 Mask Active
                </span>
              )}
            </div>
            <button
              onClick={handleDownload}
              disabled={!imageUrl && !text}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Download
            </button>
          </div>

          <div className="flex justify-center items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
            <div className="bg-white rounded-lg shadow-lg p-2">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="max-w-full h-auto border border-gray-300 dark:border-gray-600 rounded cursor-default"
                style={{
                  aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Canvas size: {CANVAS_WIDTH} × {CANVAS_HEIGHT} (9:16 ratio)
          </p>
        </div>
      </div>
    </div>
  );
}

