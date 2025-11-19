export interface ImageEditRequest {
  Text: string;
  Image: string;
  "Text Position": "top" | "bottom" | "center" | "left" | "right";
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

