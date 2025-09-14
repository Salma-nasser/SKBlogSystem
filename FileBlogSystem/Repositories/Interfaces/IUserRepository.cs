using FileBlogSystem.Models;

namespace FileBlogSystem.Repositories.Interfaces
{
  public interface IUserRepository
  {
    // Read operations
    Task<User?> GetUserByUsernameAsync(string username);
    Task<User?> GetUserByEmailAsync(string email);
    Task<IEnumerable<User>> GetAllUsersAsync();
    Task<bool> UserExistsAsync(string username);
    Task<bool> EmailExistsAsync(string email);
    Task<bool> IsUserActiveAsync(string username);

    // Write operations
    Task<bool> CreateUserAsync(User user);
    Task<bool> UpdateUserAsync(User user);
    Task<bool> DeleteUserAsync(string username);
    Task<bool> DeactivateUserAsync(string username);
    Task<bool> ActivateUserAsync(string username);

    // Authentication operations
    Task<bool> ValidatePasswordAsync(string username, string password);
    Task<bool> UpdatePasswordAsync(string username, string newPasswordHash);

    // OTP operations
    Task<bool> SaveOtpAsync(string username, string otpCode, DateTime expiry);
    Task<string?> GetOtpAsync(string username);
    Task<bool> ClearOtpAsync(string username);
    Task<bool> IsOtpValidAsync(string username, string otpCode);

    // Profile operations
    Task<bool> UpdateProfileAsync(string username, UpdateProfileRequest profileData);
  }
}
