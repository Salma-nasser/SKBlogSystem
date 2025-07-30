namespace FileBlogSystem.Models
{
  public class VerifyOtpRequest
  {
    public string Username { get; set; } = string.Empty;
    public string OTPCode { get; set; } = string.Empty;
  }
}
