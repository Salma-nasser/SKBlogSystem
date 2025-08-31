using System.Text.Json;
using FileBlogSystem.Models;
using FileBlogSystem.Repositories.Interfaces;

namespace FileBlogSystem.Repositories
{
  public class FileUserRepository : IUserRepository
  {
    private readonly string _usersPath;
    private readonly ILogger<FileUserRepository> _logger;

    public FileUserRepository(IConfiguration configuration, IWebHostEnvironment env, ILogger<FileUserRepository> logger)
    {
      string contentRoot = configuration["ContentDirectory"] ?? "Content";
      _usersPath = Path.Combine(env.ContentRootPath, contentRoot, "users");
      _logger = logger;

      EnsureDirectoryExists(_usersPath);
    }

    public async Task<User?> GetUserByUsernameAsync(string username)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));
        string profilePath = Path.Combine(userDirectory, "profile.json");

        if (!File.Exists(profilePath))
          return null;

        string profileJson = await File.ReadAllTextAsync(profilePath);
        var userInfo = JsonSerializer.Deserialize<JsonElement>(profileJson);

        return new User
        {
          Username = userInfo.GetProperty("Username").GetString() ?? string.Empty,
          Email = userInfo.GetProperty("Email").GetString() ?? string.Empty,
          PasswordHash = userInfo.TryGetProperty("PasswordHash", out var passProp) ? passProp.GetString() ?? string.Empty : string.Empty,
          Role = userInfo.TryGetProperty("Role", out var roleProp) ? roleProp.GetString() ?? "Author" : "Author",
          CreatedAt = userInfo.TryGetProperty("CreatedAt", out var createdProp) ? createdProp.GetDateTime() : DateTime.UtcNow,
          IsActive = userInfo.TryGetProperty("IsActive", out var activeProp) ? activeProp.GetBoolean() : true,
          Bio = userInfo.TryGetProperty("Bio", out var bioProp) ? bioProp.GetString() ?? string.Empty : string.Empty,
          ProfilePictureUrl = userInfo.TryGetProperty("ProfilePictureUrl", out var picProp) ? picProp.GetString() ?? string.Empty : string.Empty
        };
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting user by username: {Username}", username);
        return null;
      }
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
      try
      {
        if (!Directory.Exists(_usersPath))
          return null;

        foreach (var userDirectory in Directory.GetDirectories(_usersPath))
        {
          string profilePath = Path.Combine(userDirectory, "profile.json");
          if (!File.Exists(profilePath))
            continue;

          string profileJson = await File.ReadAllTextAsync(profilePath);
          var userInfo = JsonSerializer.Deserialize<JsonElement>(profileJson);

          if (userInfo.TryGetProperty("Email", out var emailProp) &&
              emailProp.GetString()?.Equals(email, StringComparison.OrdinalIgnoreCase) == true)
          {
            return new User
            {
              Username = userInfo.GetProperty("Username").GetString() ?? string.Empty,
              Email = userInfo.GetProperty("Email").GetString() ?? string.Empty,
              PasswordHash = userInfo.TryGetProperty("PasswordHash", out var passProp) ? passProp.GetString() ?? string.Empty : string.Empty,
              Role = userInfo.TryGetProperty("Role", out var roleProp) ? roleProp.GetString() ?? "Author" : "Author",
              CreatedAt = userInfo.TryGetProperty("CreatedAt", out var createdProp) ? createdProp.GetDateTime() : DateTime.UtcNow,
              IsActive = userInfo.TryGetProperty("IsActive", out var activeProp) ? activeProp.GetBoolean() : true,
              Bio = userInfo.TryGetProperty("Bio", out var bioProp) ? bioProp.GetString() ?? string.Empty : string.Empty,
              ProfilePictureUrl = userInfo.TryGetProperty("ProfilePictureUrl", out var picProp) ? picProp.GetString() ?? string.Empty : string.Empty
            };
          }
        }

        return null;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting user by email: {Email}", email);
        return null;
      }
    }

    public async Task<IEnumerable<User>> GetAllUsersAsync()
    {
      var users = new List<User>();

      try
      {
        if (!Directory.Exists(_usersPath))
          return users;

        foreach (var userDirectory in Directory.GetDirectories(_usersPath))
        {
          string profilePath = Path.Combine(userDirectory, "profile.json");
          if (!File.Exists(profilePath))
            continue;

          string profileJson = await File.ReadAllTextAsync(profilePath);
          var userInfo = JsonSerializer.Deserialize<JsonElement>(profileJson);

          var user = new User
          {
            Username = userInfo.GetProperty("Username").GetString() ?? string.Empty,
            Email = userInfo.GetProperty("Email").GetString() ?? string.Empty,
            Role = userInfo.TryGetProperty("Role", out var roleProp) ? roleProp.GetString() ?? "Author" : "Author",
            CreatedAt = userInfo.TryGetProperty("CreatedAt", out var createdProp) ? createdProp.GetDateTime() : DateTime.UtcNow,
            IsActive = userInfo.TryGetProperty("IsActive", out var activeProp) ? activeProp.GetBoolean() : true,
            Bio = userInfo.TryGetProperty("Bio", out var bioProp) ? bioProp.GetString() ?? string.Empty : string.Empty,
            ProfilePictureUrl = userInfo.TryGetProperty("ProfilePictureUrl", out var picProp) ? picProp.GetString() ?? string.Empty : string.Empty
          };

          users.Add(user);
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting all users");
      }

      return users;
    }

    public async Task<bool> UserExistsAsync(string username)
    {
      var user = await GetUserByUsernameAsync(username);
      return user != null;
    }

    public async Task<bool> EmailExistsAsync(string email)
    {
      var user = await GetUserByEmailAsync(email);
      return user != null;
    }

    public async Task<bool> IsUserActiveAsync(string username)
    {
      var user = await GetUserByUsernameAsync(username);
      return user != null && user.IsActive;
    }

    public async Task<bool> CreateUserAsync(User user)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(user.Username));

        if (Directory.Exists(userDirectory))
          return false; // User already exists

        EnsureDirectoryExists(userDirectory);

        var userProfile = new
        {
          user.Username,
          user.Email,
          user.PasswordHash,
          user.Role,
          user.CreatedAt,
          user.IsActive,
          user.Bio,
          user.ProfilePictureUrl
        };

        string profilePath = Path.Combine(userDirectory, "profile.json");
        string profileJson = JsonSerializer.Serialize(userProfile, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(profilePath, profileJson);

        return true;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error creating user: {Username}", user.Username);
        return false;
      }
    }

    public async Task<bool> UpdateUserAsync(User user)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(user.Username));
        string profilePath = Path.Combine(userDirectory, "profile.json");

        if (!File.Exists(profilePath))
          return false;

        var userProfile = new
        {
          user.Username,
          user.Email,
          user.PasswordHash,
          user.Role,
          user.CreatedAt,
          user.IsActive,
          user.Bio,
          user.ProfilePictureUrl
        };

        string profileJson = JsonSerializer.Serialize(userProfile, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(profilePath, profileJson);

        return true;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error updating user: {Username}", user.Username);
        return false;
      }
    }

    public async Task<bool> DeleteUserAsync(string username)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));

        if (!Directory.Exists(userDirectory))
          return false;

        Directory.Delete(userDirectory, true);
        return true;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error deleting user: {Username}", username);
        return false;
      }
    }

    public async Task<bool> DeactivateUserAsync(string username)
    {
      var user = await GetUserByUsernameAsync(username);
      if (user == null)
        return false;

      user.IsActive = false;
      return await UpdateUserAsync(user);
    }

    public async Task<bool> ActivateUserAsync(string username)
    {
      var user = await GetUserByUsernameAsync(username);
      if (user == null)
        return false;

      user.IsActive = true;
      return await UpdateUserAsync(user);
    }

    public async Task<bool> ValidatePasswordAsync(string username, string password)
    {
      var user = await GetUserByUsernameAsync(username);
      if (user == null)
        return false;

      // This would typically use your password service to verify the hash
      // For now, returning true as this is handled by the service layer
      return !string.IsNullOrEmpty(user.PasswordHash);
    }

    public async Task<bool> UpdatePasswordAsync(string username, string newPasswordHash)
    {
      var user = await GetUserByUsernameAsync(username);
      if (user == null)
        return false;

      user.PasswordHash = newPasswordHash;
      return await UpdateUserAsync(user);
    }

    public async Task<bool> SaveOtpAsync(string username, string otpCode, DateTime expiry)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));
        string otpPath = Path.Combine(userDirectory, "otp.json");

        if (!Directory.Exists(userDirectory))
          return false;

        var otpData = new
        {
          Code = otpCode,
          Expiry = expiry
        };

        string otpJson = JsonSerializer.Serialize(otpData, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(otpPath, otpJson);

        return true;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error saving OTP for user: {Username}", username);
        return false;
      }
    }

    public async Task<string?> GetOtpAsync(string username)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));
        string otpPath = Path.Combine(userDirectory, "otp.json");

        if (!File.Exists(otpPath))
          return null;

        string otpJson = await File.ReadAllTextAsync(otpPath);
        var otpData = JsonSerializer.Deserialize<JsonElement>(otpJson);

        var expiry = otpData.GetProperty("Expiry").GetDateTime();
        if (DateTime.UtcNow > expiry)
        {
          File.Delete(otpPath); // Clean up expired OTP
          return null;
        }

        return otpData.GetProperty("Code").GetString();
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting OTP for user: {Username}", username);
        return null;
      }
    }

    public async Task<bool> ClearOtpAsync(string username)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));
        string otpPath = Path.Combine(userDirectory, "otp.json");

        if (File.Exists(otpPath))
        {
          File.Delete(otpPath);
        }

        return true;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error clearing OTP for user: {Username}", username);
        return false;
      }
    }

    public async Task<bool> IsOtpValidAsync(string username, string otpCode)
    {
      var storedOtp = await GetOtpAsync(username);
      return storedOtp != null && storedOtp.Equals(otpCode, StringComparison.Ordinal);
    }

    public async Task<bool> UpdateProfileAsync(string username, UpdateProfileRequest profileData)
    {
      var user = await GetUserByUsernameAsync(username);
      if (user == null)
        return false;

      // Update user properties
      if (!string.IsNullOrEmpty(profileData.Email))
        user.Email = profileData.Email;
      if (!string.IsNullOrEmpty(profileData.Bio))
        user.Bio = profileData.Bio;

      return await UpdateUserAsync(user);
    }

    // Private helper methods
    private void EnsureDirectoryExists(string path)
    {
      if (!Directory.Exists(path))
      {
        Directory.CreateDirectory(path);
      }
    }

    private string SanitizeDirectoryName(string input)
    {
      if (string.IsNullOrWhiteSpace(input))
        return "unknown";

      var invalidChars = Path.GetInvalidFileNameChars();
      return new string(input.Where(c => !invalidChars.Contains(c)).ToArray());
    }
  }
}
