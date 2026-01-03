import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useApi } from 'src/api';
import { useConversationBucketAvailabilities } from 'src/hooks/api/extensions';
import { useConversationFiles } from 'src/hooks/api/files';
import { useChatDropzone } from './useChatDropzone';
import { useStateOfSelectedAssistantId, useStateOfSelectedChatId } from './state/chat';

vi.mock('src/api', () => ({
  useApi: vi.fn(),
}));

vi.mock('src/hooks/api/extensions', () => ({
  useConversationBucketAvailabilities: vi.fn(),
}));

vi.mock('src/hooks/api/files', () => ({
  useConversationFiles: vi.fn(),
}));

vi.mock('./state/chat', () => ({
  useStateOfSelectedAssistantId: vi.fn(),
  useStateOfSelectedChatId: vi.fn(),
}));

vi.mock('src/hooks', () => ({
  useTypedMutationStates: vi.fn(() => []),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}));

describe('useChatDropzone - File Upload Limits (Issue #807)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApi).mockReturnValue({} as any);
    vi.mocked(useStateOfSelectedAssistantId).mockReturnValue(1);
    vi.mocked(useStateOfSelectedChatId).mockReturnValue(100);
  });

  describe('Bug Fix: Independent file limits per extension', () => {
    it('should correctly count files when one extension accepts all types and another accepts specific types', () => {
      // Setup: Files in Chat (5 limit, all types) + Images in Chat (3 limit, images only)
      vi.mocked(useConversationBucketAvailabilities).mockReturnValue({
        data: {
          extensions: [
            {
              extensionId: 1,
              title: 'Files in Chat',
              maxFiles: 5,
              fileNameExtensions: [], // Empty = accepts all types
            },
            {
              extensionId: 2,
              title: 'Images in Chat',
              maxFiles: 3,
              fileNameExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
            },
          ],
        },
        refetch: vi.fn(),
      } as any);

      // Scenario: 3 image files already uploaded
      vi.mocked(useConversationFiles).mockReturnValue({
        data: [
          { id: 1, fileName: 'image1.png' },
          { id: 2, fileName: 'image2.jpg' },
          { id: 3, fileName: 'image3.png' },
        ],
        refetch: vi.fn(),
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useChatDropzone());

      const fileSlots = result.current.fileSlots;

      // Files in Chat should have 5 remaining slots (images don't count against it)
      const filesInChatSlot = fileSlots?.find((slot) => slot.extensionTitle === 'Files in Chat');
      expect(filesInChatSlot?.remainingSlots).toBe(5);
      expect(filesInChatSlot?.hasNoFileSlotLeft).toBe(false);

      // Images in Chat should have 0 remaining slots (3 images uploaded)
      const imagesInChatSlot = fileSlots?.find((slot) => slot.extensionTitle === 'Images in Chat');
      expect(imagesInChatSlot?.remainingSlots).toBe(0);
      expect(imagesInChatSlot?.hasNoFileSlotLeft).toBe(true);
    });

    it('should correctly count when images and regular files are both present', () => {
      vi.mocked(useConversationBucketAvailabilities).mockReturnValue({
        data: {
          extensions: [
            {
              extensionId: 1,
              title: 'Files in Chat',
              maxFiles: 5,
              fileNameExtensions: [],
            },
            {
              extensionId: 2,
              title: 'Images in Chat',
              maxFiles: 3,
              fileNameExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
            },
          ],
        },
        refetch: vi.fn(),
      } as any);

      // Scenario: 2 images + 2 PDFs uploaded
      vi.mocked(useConversationFiles).mockReturnValue({
        data: [
          { id: 1, fileName: 'image1.png' },
          { id: 2, fileName: 'image2.jpg' },
          { id: 3, fileName: 'document1.pdf' },
          { id: 4, fileName: 'document2.pdf' },
        ],
        refetch: vi.fn(),
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useChatDropzone());

      const fileSlots = result.current.fileSlots;

      // Files in Chat: should count only the 2 PDFs, leaving 3 slots
      const filesInChatSlot = fileSlots?.find((slot) => slot.extensionTitle === 'Files in Chat');
      expect(filesInChatSlot?.remainingSlots).toBe(3);

      // Images in Chat: should count only the 2 images, leaving 1 slot
      const imagesInChatSlot = fileSlots?.find((slot) => slot.extensionTitle === 'Images in Chat');
      expect(imagesInChatSlot?.remainingSlots).toBe(1);
    });

    it('should handle the case where both limits are reached independently', () => {
      vi.mocked(useConversationBucketAvailabilities).mockReturnValue({
        data: {
          extensions: [
            {
              extensionId: 1,
              title: 'Files in Chat',
              maxFiles: 5,
              fileNameExtensions: [],
            },
            {
              extensionId: 2,
              title: 'Images in Chat',
              maxFiles: 3,
              fileNameExtensions: ['.png', '.jpg'],
            },
          ],
        },
        refetch: vi.fn(),
      } as any);

      // Scenario: 5 PDFs + 3 images (both limits reached)
      vi.mocked(useConversationFiles).mockReturnValue({
        data: [
          { id: 1, fileName: 'doc1.pdf' },
          { id: 2, fileName: 'doc2.pdf' },
          { id: 3, fileName: 'doc3.pdf' },
          { id: 4, fileName: 'doc4.pdf' },
          { id: 5, fileName: 'doc5.pdf' },
          { id: 6, fileName: 'img1.png' },
          { id: 7, fileName: 'img2.jpg' },
          { id: 8, fileName: 'img3.png' },
        ],
        refetch: vi.fn(),
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useChatDropzone());

      const fileSlots = result.current.fileSlots;

      // Both should have 0 remaining slots
      const filesInChatSlot = fileSlots?.find((slot) => slot.extensionTitle === 'Files in Chat');
      expect(filesInChatSlot?.remainingSlots).toBe(0);
      expect(filesInChatSlot?.hasNoFileSlotLeft).toBe(true);

      const imagesInChatSlot = fileSlots?.find((slot) => slot.extensionTitle === 'Images in Chat');
      expect(imagesInChatSlot?.remainingSlots).toBe(0);
      expect(imagesInChatSlot?.hasNoFileSlotLeft).toBe(true);

      // Upload limit should be reached
      expect(result.current.uploadLimitReached).toBe(true);
    });

    it('should handle multiple extensions with specific file types', () => {
      vi.mocked(useConversationBucketAvailabilities).mockReturnValue({
        data: {
          extensions: [
            {
              extensionId: 1,
              title: 'Images',
              maxFiles: 3,
              fileNameExtensions: ['.png', '.jpg'],
            },
            {
              extensionId: 2,
              title: 'Videos',
              maxFiles: 2,
              fileNameExtensions: ['.mp4', '.avi'],
            },
            {
              extensionId: 3,
              title: 'Documents',
              maxFiles: 5,
              fileNameExtensions: ['.pdf', '.docx'],
            },
          ],
        },
        refetch: vi.fn(),
      } as any);

      vi.mocked(useConversationFiles).mockReturnValue({
        data: [
          { id: 1, fileName: 'image.png' },
          { id: 2, fileName: 'video.mp4' },
          { id: 3, fileName: 'doc.pdf' },
        ],
        refetch: vi.fn(),
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useChatDropzone());

      const fileSlots = result.current.fileSlots;

      // Each extension should count only its own file type
      expect(fileSlots?.find((s) => s.extensionTitle === 'Images')?.remainingSlots).toBe(2);
      expect(fileSlots?.find((s) => s.extensionTitle === 'Videos')?.remainingSlots).toBe(1);
      expect(fileSlots?.find((s) => s.extensionTitle === 'Documents')?.remainingSlots).toBe(4);
    });

    it('should handle no files uploaded', () => {
      vi.mocked(useConversationBucketAvailabilities).mockReturnValue({
        data: {
          extensions: [
            {
              extensionId: 1,
              title: 'Files in Chat',
              maxFiles: 5,
              fileNameExtensions: [],
            },
            {
              extensionId: 2,
              title: 'Images in Chat',
              maxFiles: 3,
              fileNameExtensions: ['.png', '.jpg'],
            },
          ],
        },
        refetch: vi.fn(),
      } as any);

      vi.mocked(useConversationFiles).mockReturnValue({
        data: [],
        refetch: vi.fn(),
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useChatDropzone());

      const fileSlots = result.current.fileSlots;

      // All slots should be available
      expect(fileSlots?.find((s) => s.extensionTitle === 'Files in Chat')?.remainingSlots).toBe(5);
      expect(fileSlots?.find((s) => s.extensionTitle === 'Images in Chat')?.remainingSlots).toBe(3);
      expect(result.current.uploadLimitReached).toBe(false);
    });

    it('should handle extension with no max files limit', () => {
      vi.mocked(useConversationBucketAvailabilities).mockReturnValue({
        data: {
          extensions: [
            {
              extensionId: 1,
              title: 'Unlimited Files',
              maxFiles: undefined, // No limit
              fileNameExtensions: [],
            },
          ],
        },
        refetch: vi.fn(),
      } as any);

      vi.mocked(useConversationFiles).mockReturnValue({
        data: [
          { id: 1, fileName: 'file1.pdf' },
          { id: 2, fileName: 'file2.pdf' },
          { id: 3, fileName: 'file3.pdf' },
        ],
        refetch: vi.fn(),
        remove: vi.fn(),
      } as any);

      const { result } = renderHook(() => useChatDropzone());

      const fileSlots = result.current.fileSlots;

      // Should have practically unlimited slots (Number.MAX_SAFE_INTEGER - 3)
      const unlimitedSlot = fileSlots?.find((s) => s.extensionTitle === 'Unlimited Files');
      expect(unlimitedSlot?.remainingSlots).toBeGreaterThan(1000000);
      expect(unlimitedSlot?.hasNoFileSlotLeft).toBe(false);
    });
  });
});
