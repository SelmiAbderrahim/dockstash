// examples/video-upload-flow.spec.ts
// Complete E2E test example for video upload workflow

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';
import { VideoDetailPage } from '../pages/VideoDetailPage';

test.describe('Video Upload Workflow', () => {
  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    // In production, use auth.json (saved state)
    // For demo, login each time
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'TestPassword123');
  });

  test('should upload video from YouTube URL', async ({ page }) => {
    // 1. Navigate to dashboard
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Verify on dashboard
    const initialVideoCount = await dashboardPage.getVideoCount();
    expect(initialVideoCount).toBeGreaterThanOrEqual(0);

    // 2. Start upload
    await dashboardPage.clickUpload();

    // 3. Upload from YouTube
    const uploadPage = new UploadPage(page);
    await uploadPage.selectUploadMethod('youtube');

    // Fill YouTube URL
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    await uploadPage.fillYouTubeUrl(youtubeUrl);

    // Fill metadata
    const videoTitle = 'Test Video Upload';
    const videoDescription = 'This is a test video for the upload flow';

    await uploadPage.fillVideoTitle(videoTitle);
    await uploadPage.fillVideoDescription(videoDescription);

    // 4. Submit
    await uploadPage.clickUploadButton();

    // 5. Verify upload initiated
    await expect(page).toHaveURL(/.*videos.*/);

    // 6. Wait for processing
    await expect(page.getByText(/processing|transcribing/i)).toBeVisible({
      timeout: 10000,
    });

    // 7. View video details
    const videoDetailPage = new VideoDetailPage(page);

    // Verify metadata
    await expect(page.locator('h1')).toContainText(videoTitle);
    await expect(page.getByText(videoDescription)).toBeVisible();

    // 8. Wait for transcription
    await videoDetailPage.waitForTranscriptionComplete({ timeout: 60000 });

    // 9. Verify transcription loaded
    const transcriptText = await videoDetailPage.getTranscriptText();
    expect(transcriptText.length).toBeGreaterThan(0);

    // 10. Test transcript search
    const searchTerm = 'never';
    await videoDetailPage.searchTranscript(searchTerm);

    // Verify search results
    const searchResults = page.locator('[data-test="search-result"]');
    await expect(searchResults.first()).toBeVisible();

    // 11. Navigate to transcript section
    const segmentTime = 30;
    await videoDetailPage.clickSegmentAtTime(segmentTime);

    // Verify video position
    const currentTime = await videoDetailPage.getVideoCurrentTime();
    expect(Math.abs(currentTime - segmentTime)).toBeLessThan(2); // Within 2 seconds

    // 12. Return to dashboard
    await page.goto('/dashboard');

    // Verify video appears in list
    const finalVideoCount = await dashboardPage.getVideoCount();
    expect(finalVideoCount).toBe(initialVideoCount + 1);

    const videoTitles = await dashboardPage.getVideoTitles();
    expect(videoTitles).toContain(videoTitle);
  });

  test('should upload video from file', async ({ page }) => {
    // 1. Navigate to dashboard
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // 2. Start upload
    await dashboardPage.clickUpload();

    // 3. Upload from file
    const uploadPage = new UploadPage(page);
    await uploadPage.selectUploadMethod('file');

    // Create a test video file (in real scenario)
    // For now, simulate file upload
    await uploadPage.uploadVideoFile('test-video.mp4');

    // Fill metadata
    await uploadPage.fillVideoTitle('File Upload Test');

    // 4. Submit
    await uploadPage.clickUploadButton();

    // 5. Verify upload started
    await expect(page).toHaveURL(/.*videos.*/);

    await expect(page.getByText(/processing|uploaded/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await dashboardPage.clickUpload();

    const uploadPage = new UploadPage(page);
    await uploadPage.selectUploadMethod('youtube');

    // 1. Test with invalid URL
    await uploadPage.fillYouTubeUrl('not-a-valid-url');
    await uploadPage.clickUploadButton();

    // Verify error message
    await expect(page.getByText(/invalid.*url/i)).toBeVisible();

    // 2. Test with empty title
    await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=test123');
    await uploadPage.fillVideoTitle('');
    await uploadPage.clickUploadButton();

    // Verify validation error
    await expect(page.getByText(/title.*required/i)).toBeVisible();
  });

  test('should display upload progress', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await dashboardPage.clickUpload();

    const uploadPage = new UploadPage(page);
    await uploadPage.selectUploadMethod('youtube');
    await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await uploadPage.fillVideoTitle('Progress Test');

    // Monitor progress
    const progressBar = page.locator('[data-test="upload-progress"]');

    await uploadPage.clickUploadButton();

    // Verify progress starts
    await expect(progressBar).toBeVisible();

    // Wait for progress to complete
    await progressBar.waitFor({ state: 'hidden', timeout: 60000 });

    // Verify success
    await expect(page.getByText(/success|complete/i)).toBeVisible();
  });

  test('should handle network errors', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/videos/**', route => {
      route.abort('failed');
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await dashboardPage.clickUpload();

    const uploadPage = new UploadPage(page);
    await uploadPage.selectUploadMethod('youtube');
    await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=test123');
    await uploadPage.fillVideoTitle('Network Error Test');

    await uploadPage.clickUploadButton();

    // Verify error handling
    await expect(page.getByText(/error|failed|try again/i)).toBeVisible();

    // Verify retry button exists
    const retryButton = page.getByRole('button', { name: /retry/i });
    expect(await retryButton.isVisible()).toBe(true);
  });

  test('should maintain upload draft on navigation away', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await dashboardPage.clickUpload();

    const uploadPage = new UploadPage(page);
    await uploadPage.selectUploadMethod('youtube');
    await uploadPage.fillYouTubeUrl('https://www.youtube.com/watch?v=test123');
    await uploadPage.fillVideoTitle('Draft Test');

    // Navigate away without submitting
    await page.goto('/dashboard');

    // Navigate back to upload
    await dashboardPage.clickUpload();

    // Verify draft is preserved
    const urlInput = page.getByLabel(/youtube.*url/i);
    const titleInput = page.getByLabel(/title/i);

    expect(await urlInput.inputValue()).toContain('youtube.com');
    expect(await titleInput.inputValue()).toBe('Draft Test');
  });

  test('should support concurrent uploads from different users', async ({
    browser,
  }) => {
    // Simulate two users uploading simultaneously
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    // Using saved auth state for performance
    await context1.addCookies([
      { name: 'auth_token', value: 'test_token_user1', url: 'http://localhost:5173' },
    ]);
    await context2.addCookies([
      { name: 'auth_token', value: 'test_token_user2', url: 'http://localhost:5173' },
    ]);

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1 starts upload
      const dashboardPage1 = new DashboardPage(page1);
      await dashboardPage1.goto();
      const initialCount1 = await dashboardPage1.getVideoCount();

      // User 2 starts upload
      const dashboardPage2 = new DashboardPage(page2);
      await dashboardPage2.goto();
      const initialCount2 = await dashboardPage2.getVideoCount();

      // Both click upload
      await Promise.all([
        dashboardPage1.clickUpload(),
        dashboardPage2.clickUpload(),
      ]);

      // Both fill forms
      const uploadPage1 = new UploadPage(page1);
      const uploadPage2 = new UploadPage(page2);

      await uploadPage1.selectUploadMethod('youtube');
      await uploadPage2.selectUploadMethod('youtube');

      await uploadPage1.fillYouTubeUrl('https://www.youtube.com/watch?v=video1');
      await uploadPage2.fillYouTubeUrl('https://www.youtube.com/watch?v=video2');

      await uploadPage1.fillVideoTitle('User 1 Video');
      await uploadPage2.fillVideoTitle('User 2 Video');

      // Both submit simultaneously
      await Promise.all([
        uploadPage1.clickUploadButton(),
        uploadPage2.clickUploadButton(),
      ]);

      // Both should succeed
      await page1.waitForURL(/.*videos.*/);
      await page2.waitForURL(/.*videos.*/);

      // Return to dashboard
      await page1.goto('/dashboard');
      await page2.goto('/dashboard');

      const finalCount1 = await dashboardPage1.getVideoCount();
      const finalCount2 = await dashboardPage2.getVideoCount();

      expect(finalCount1).toBe(initialCount1 + 1);
      expect(finalCount2).toBe(initialCount2 + 1);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should meet Core Web Vitals during upload', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Measure metrics
    const metrics = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const lcp = performance
        .getEntriesByType('largest-contentful-paint')
        .pop();

      return {
        fcp: (fcp as any)?.startTime || 0,
        lcp: (lcp as any)?.startTime || 0,
      };
    });

    // Verify Core Web Vitals
    expect(metrics.fcp).toBeLessThan(1500); // FCP < 1.5s
    expect(metrics.lcp).toBeLessThan(2500); // LCP < 2.5s
  });
});
