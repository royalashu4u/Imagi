"use client";

import { useState } from "react";

type TextPosition = "top" | "bottom" | "center" | "left" | "right";

export default function ImageEditor() {
  const [imageUrl, setImageUrl] = useState("");
  const [text, setText] = useState("");
  const [position, setPosition] = useState<TextPosition>("bottom");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file");
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      // For preview, use object URL (faster)
      const objectUrl = URL.createObjectURL(file);
      setPreviewImage(objectUrl);

      // Convert file to base64 data URL for API
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImageUrl(dataUrl);
        setError(null);
      };
      reader.onerror = () => {
        setError("Failed to read the file");
        setPreviewImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setImageUrl(url);
    setPreviewImage(url || null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultImage(null);

    try {
      // Validate inputs
      if (!imageUrl.trim()) {
        throw new Error("Please provide an image URL or upload an image");
      }
      if (!text.trim()) {
        throw new Error("Please enter the text to add to the image");
      }

      // Make API request
      const response = await fetch("/api/img", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Text: text,
          Image: imageUrl,
          "Text Position": position,
        }),
      });

      // Check if response is an image or error
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        // It's an error response (JSON)
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Failed to process image");
      }

      if (contentType?.startsWith("image/")) {
        // It's an image response
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setResultImage(imageUrl);
      } else {
        // Unexpected response format
        const text = await response.text();
        throw new Error(`Unexpected response: ${text}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Image Text Editor</h1>
        <p className="text-muted-foreground">
          Upload an image or provide a URL, add your text, and choose the position
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Input Section */}
            <div className="space-y-2">
              <label htmlFor="image" className="block text-sm font-medium">
                Reference Image
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
                    id="image"
                    value={imageUrl}
                    onChange={handleUrlChange}
                    placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                    className="block w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Text Input */}
            <div className="space-y-2">
              <label htmlFor="text" className="block text-sm font-medium">
                Text to Add
              </label>
              <textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter the text you want to add to the image (max 2 lines)"
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500">
                Note: The text will be automatically formatted into a maximum of 2 lines
              </p>
            </div>

            {/* Position Dropdown */}
            <div className="space-y-2">
              <label htmlFor="position" className="block text-sm font-medium">
                Text Position
              </label>
              <select
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value as TextPosition)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="center">Center</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !imageUrl.trim() || !text.trim()}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Generate Edited Image"
              )}
            </button>
          </form>
        </div>

        {/* Right Column - Output/Result */}
        <div className="space-y-6">
          {/* Preview Section */}
          {previewImage && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Input Preview</h2>
              <div className="relative w-full border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="w-full h-auto object-contain max-h-96"
                  onError={() => {
                    setError("Failed to load preview image. Please check the URL.");
                    setPreviewImage(null);
                  }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Result Display */}
          {resultImage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Result</h2>
                <a
                  href={resultImage}
                  download="edited-image.jpg"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  Download
                </a>
              </div>
              <div className="relative w-full border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
                <img
                  src={resultImage}
                  alt="Edited result"
                  className="w-full h-auto object-contain max-h-96"
                />
              </div>
            </div>
          ) : (
            !previewImage && (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-500 dark:text-gray-400">
                  Result will appear here after processing
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

