namespace FileBlogSystem.Models;

public class UpdateProfileRequest
{
  public string? Email { get; set; }
  public string? ConfirmPassword { get; set; }
  public string? ProfilePictureBase64 { get; set; } // Optional: base64-encoded image
  public string? ProfilePictureFileName { get; set; } // Optional: file name for the uploaded image
  public string? Bio { get; set; } // Optional: user bio
}