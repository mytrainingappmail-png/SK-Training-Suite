// src/services/contentEditor/contentEditorService.ts
// Business logic only — no Supabase imports.

import {
  getLessonContent,
  updateLessonContent,
  uploadContentMedia,
} from '../../repositories/contentEditor/contentEditorRepository';
import { getCurrentUser } from '../auth/session';
import { getSettingNumber } from '../setting/settingService';
import type { LessonContent, MediaUploadResult } from '../../types/contentEditor';

const IMAGE_EXTENSIONS    = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXTENSIONS    = ['mp4'];
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip'];

// Defaults when no active "max_*_upload_mb" Setting exists — an admin can
// override these from Settings Management without any code change.
const DEFAULT_MAX_IMAGE_MB    = 10;
const DEFAULT_MAX_VIDEO_MB    = 200;
const DEFAULT_MAX_DOCUMENT_MB = 25;

const MAX_VIDEO_BYTES = DEFAULT_MAX_VIDEO_MB * 1024 * 1024;

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
}

function requireEmployeeId(): string {
  const user = getCurrentUser();
  if (!user?.id) {
    throw new Error('You must be signed in to upload media.');
  }
  return user.id;
}

export async function loadLessonContent(lessonId: string): Promise<LessonContent> {
  if (!lessonId) {
    throw new Error('Invalid Lesson ID.');
  }

  return await getLessonContent(lessonId);
}

export async function saveLessonContent(
  lessonId: string,
  content: string
): Promise<LessonContent> {
  if (!lessonId) {
    throw new Error('Invalid Lesson ID.');
  }

  return await updateLessonContent(lessonId, content);
}

export async function uploadImage(file: File): Promise<MediaUploadResult> {
  const ext = getExtension(file.name);
  if (!IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error('Unsupported image type. Allowed: JPG, JPEG, PNG, WEBP, GIF.');
  }
  const maxImageMb = await getSettingNumber('max_image_upload_mb', DEFAULT_MAX_IMAGE_MB);
  if (file.size > maxImageMb * 1024 * 1024) {
    throw new Error(`Image is too large. Maximum size is ${maxImageMb}MB.`);
  }

  const employeeId = requireEmployeeId();
  return await uploadContentMedia('image', file, employeeId);
}

export async function uploadVideo(file: File): Promise<MediaUploadResult> {
  const ext = getExtension(file.name);
  if (!VIDEO_EXTENSIONS.includes(ext)) {
    throw new Error('Unsupported video type. Only MP4 is supported.');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video is too large. Maximum size is 200MB.');
  }

  const employeeId = requireEmployeeId();
  return await uploadContentMedia('video', file, employeeId);
}

export async function uploadDocument(file: File): Promise<MediaUploadResult> {
  const ext = getExtension(file.name);
  if (!DOCUMENT_EXTENSIONS.includes(ext)) {
    throw new Error(
      'Unsupported file type. Allowed: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP.'
    );
  }
  const maxDocumentMb = await getSettingNumber('max_document_upload_mb', DEFAULT_MAX_DOCUMENT_MB);
  if (file.size > maxDocumentMb * 1024 * 1024) {
    throw new Error(`File is too large. Maximum size is ${maxDocumentMb}MB.`);
  }

  const employeeId = requireEmployeeId();
  return await uploadContentMedia('document', file, employeeId);
}
