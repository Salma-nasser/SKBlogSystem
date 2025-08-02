using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;

namespace FileBlogSystem.Services;

public class ImageService
{
  private static readonly HashSet<string> AllowedExtensions = new HashSet<string>
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };
  public static async Task<string> SaveAndCompressAsync(IFormFile image, string outputDirectory, string filePrefix = "")
  {
    Directory.CreateDirectory(outputDirectory);

    string extension = Path.GetExtension(image.FileName).ToLowerInvariant();
    if (!AllowedExtensions.Contains(extension))
      throw new InvalidOperationException("Unsupported image format.");

    string sanitizedFileName = SanitizeFileName(Path.GetFileNameWithoutExtension(image.FileName));
    string fileName = $"{filePrefix}{sanitizedFileName}{extension}";
    string filePath = Path.Combine(outputDirectory, fileName);

    int counter = 1;
    while (File.Exists(filePath))
    {
      fileName = $"{filePrefix}{sanitizedFileName}_{counter++}{extension}";
      filePath = Path.Combine(outputDirectory, fileName);
    }

    using var stream = image.OpenReadStream();
    using var imageSharp = await Image.LoadAsync(stream);

    imageSharp.Mutate(x => x.Resize(new ResizeOptions
    {
      Size = new Size(1200, 630),
      Mode = ResizeMode.Max,
      Sampler = KnownResamplers.Lanczos3
    }));

    await SaveWithFormatAsync(imageSharp, filePath, extension);

    return fileName;
  }

  public static async Task<string> SaveAndCompressFromBase64Async(string base64, string originalFileName, string outputDirectory, string filePrefix = "")
  {
    Directory.CreateDirectory(outputDirectory);

    string extension = Path.GetExtension(originalFileName).ToLowerInvariant();
    if (!AllowedExtensions.Contains(extension))
      throw new InvalidOperationException("Unsupported image format.");

    string sanitizedFileName = SanitizeFileName(Path.GetFileNameWithoutExtension(originalFileName));
    string fileName = $"{filePrefix}{sanitizedFileName}{extension}";
    string filePath = Path.Combine(outputDirectory, fileName);

    int counter = 1;
    while (File.Exists(filePath))
    {
      fileName = $"{filePrefix}{sanitizedFileName}_{counter++}{extension}";
      filePath = Path.Combine(outputDirectory, fileName);
    }

    byte[] imageBytes = Convert.FromBase64String(base64);
    using var ms = new MemoryStream(imageBytes);
    using var imageSharp = await Image.LoadAsync(ms);

    // Resize profile pictures to fit within a 400x400 square, preserving aspect ratio
    imageSharp.Mutate(x => x.Resize(new ResizeOptions
    {
      Size = new Size(400, 400),
      Mode = ResizeMode.Max,
      Sampler = KnownResamplers.Lanczos3
    }));

    await SaveWithFormatAsync(imageSharp, filePath, extension);

    return fileName;
  }

  private static async Task SaveWithFormatAsync(Image image, string filePath, string extension)
  {
    switch (extension)
    {
      case ".jpg":
      case ".jpeg":
        var jpegEncoder = new JpegEncoder { Quality = 80 };
        await image.SaveAsync(filePath, jpegEncoder);
        break;

      case ".png":
        var pngEncoder = new PngEncoder();
        await image.SaveAsync(filePath, pngEncoder);
        break;

      case ".webp":
        var webpEncoder = new WebpEncoder { Quality = 80 };
        await image.SaveAsync(filePath, webpEncoder);
        break;

      default:
        throw new InvalidOperationException("Unsupported image format for saving.");
    }
  }

  private static string SanitizeFileName(string fileName)
  {
    return Regex.Replace(fileName, @"[^a-zA-Z0-9_-]", "_");
  }
}
