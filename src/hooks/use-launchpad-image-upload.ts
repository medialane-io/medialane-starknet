"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFileToIpfs } from "@/lib/ipfs-upload-client";
import { uploadSizeError } from "@medialane/sdk";

interface UseLaunchpadImageUploadOptions {
  allowedTypes?: string[];
  successMessage: string;
  failureMessage?: string;
  invalidTypeTitle?: string;
  invalidTypeDescription?: string;
}

export function useLaunchpadImageUpload({
  allowedTypes,
  successMessage,
  failureMessage = "Image upload failed",
  invalidTypeTitle = "Unsupported format",
  invalidTypeDescription,
}: UseLaunchpadImageUploadOptions) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUri(null);
    setUploadError(null);
    setUploadSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageSelect = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (allowedTypes && !allowedTypes.includes(file.type)) {
      setUploadError(
        invalidTypeDescription
          ? `${invalidTypeTitle}: ${invalidTypeDescription}`
          : invalidTypeTitle
      );
      return;
    }

    const sizeError = uploadSizeError(file, "image");
    if (sizeError) {
      setUploadError(sizeError);
      return;
    }

    setImageFile(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
    setImageUri(null);
    setImageUploading(true);

    try {
      const uploaded = await uploadFileToIpfs(file);

      setImageUri(uploaded.uri);
      setUploadSuccess(successMessage);
    } catch (error) {
      setImageUri(null);
      const aborted = error instanceof DOMException && error.name === "AbortError";
      const msg = aborted
        ? "the image service is slow right now — please try again"
        : error instanceof Error ? error.message : undefined;
      setUploadError(msg ? `${failureMessage}: ${msg}` : failureMessage);
    } finally {
      setImageUploading(false);
    }
  };

  return {
    imageFile,
    imagePreview,
    imageUri,
    imageUploading,
    uploadError,
    uploadSuccess,
    fileInputRef,
    setImagePreview,
    setImageUri,
    handleImageSelect,
    clearImage,
  };
}
