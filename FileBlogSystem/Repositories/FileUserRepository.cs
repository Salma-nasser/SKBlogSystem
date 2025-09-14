using System.Text.Json;
using FileBlogSystem.Models;
using FileBlogSystem.Repositories.Interfaces;
using FileBlogSystem.Services;

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

        // Normalize legacy profile picture paths to secure API endpoint
        string rawPic = userInfo.TryGetProperty("ProfilePictureUrl", out var picProp) ? picProp.GetString() ?? string.Empty : string.Empty;
        string normalizedPic = NormalizeProfilePictureUrl(username, rawPic);

        return new User
        {
          Username = userInfo.GetProperty("Username").GetString() ?? string.Empty,
          Email = userInfo.GetProperty("Email").GetString() ?? string.Empty,
          PasswordHash = userInfo.TryGetProperty("PasswordHash", out var passProp) ? passProp.GetString() ?? string.Empty : string.Empty,
          Role = userInfo.TryGetProperty("Role", out var roleProp) ? roleProp.GetString() ?? "Author" : "Author",
          CreatedAt = userInfo.TryGetProperty("CreatedAt", out var createdProp) ? createdProp.GetDateTime() : DateTime.UtcNow,
          IsActive = userInfo.TryGetProperty("IsActive", out var activeProp) ? activeProp.GetBoolean() : true,
          Bio = userInfo.TryGetProperty("Bio", out var bioProp) ? bioProp.GetString() ?? string.Empty : string.Empty,
          ProfilePictureUrl = normalizedPic,
          PublishedPostsCount = userInfo.TryGetProperty("PublishedPostsCount", out var pubProp) && pubProp.ValueKind == System.Text.Json.JsonValueKind.Number ? pubProp.GetInt32() : 0
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
            string rawPic = userInfo.TryGetProperty("ProfilePictureUrl", out var picProp) ? picProp.GetString() ?? string.Empty : string.Empty;
            string normalizedPic = NormalizeProfilePictureUrl(userInfo.GetProperty("Username").GetString() ?? string.Empty, rawPic);
            return new User
            {
              Username = userInfo.GetProperty("Username").GetString() ?? string.Empty,
              Email = userInfo.GetProperty("Email").GetString() ?? string.Empty,
              PasswordHash = userInfo.TryGetProperty("PasswordHash", out var passProp) ? passProp.GetString() ?? string.Empty : string.Empty,
              Role = userInfo.TryGetProperty("Role", out var roleProp) ? roleProp.GetString() ?? "Author" : "Author",
              CreatedAt = userInfo.TryGetProperty("CreatedAt", out var createdProp) ? createdProp.GetDateTime() : DateTime.UtcNow,
              IsActive = userInfo.TryGetProperty("IsActive", out var activeProp) ? activeProp.GetBoolean() : true,
              Bio = userInfo.TryGetProperty("Bio", out var bioProp) ? bioProp.GetString() ?? string.Empty : string.Empty,
              ProfilePictureUrl = normalizedPic,
              PublishedPostsCount = userInfo.TryGetProperty("PublishedPostsCount", out var pubProp2) && pubProp2.ValueKind == System.Text.Json.JsonValueKind.Number ? pubProp2.GetInt32() : 0
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

          string rawPic = userInfo.TryGetProperty("ProfilePictureUrl", out var picProp) ? picProp.GetString() ?? string.Empty : string.Empty;
          string normalizedPic = NormalizeProfilePictureUrl(userInfo.GetProperty("Username").GetString() ?? string.Empty, rawPic);
          var user = new User
          {
            Username = userInfo.GetProperty("Username").GetString() ?? string.Empty,
            Email = userInfo.GetProperty("Email").GetString() ?? string.Empty,
            Role = userInfo.TryGetProperty("Role", out var roleProp) ? roleProp.GetString() ?? "Author" : "Author",
            CreatedAt = userInfo.TryGetProperty("CreatedAt", out var createdProp) ? createdProp.GetDateTime() : DateTime.UtcNow,
            IsActive = userInfo.TryGetProperty("IsActive", out var activeProp) ? activeProp.GetBoolean() : true,
            Bio = userInfo.TryGetProperty("Bio", out var bioProp) ? bioProp.GetString() ?? string.Empty : string.Empty,
            ProfilePictureUrl = normalizedPic,
            PublishedPostsCount = userInfo.TryGetProperty("PublishedPostsCount", out var pubProp3) && pubProp3.ValueKind == System.Text.Json.JsonValueKind.Number ? pubProp3.GetInt32() : 0
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
          user.ProfilePictureUrl,
          user.PublishedPostsCount
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
          user.ProfilePictureUrl,
          user.PublishedPostsCount
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

    public Task<bool> DeleteUserAsync(string username)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));

        if (!Directory.Exists(userDirectory))
          return Task.FromResult(false);

        Directory.Delete(userDirectory, true);
        return Task.FromResult(true);
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error deleting user: {Username}", username);
        return Task.FromResult(false);
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

    public Task<bool> ClearOtpAsync(string username)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));
        string otpPath = Path.Combine(userDirectory, "otp.json");

        if (File.Exists(otpPath))
        {
          File.Delete(otpPath);
        }

        return Task.FromResult(true);
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error clearing OTP for user: {Username}", username);
        return Task.FromResult(false);
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

      // Handle profile picture update if provided
      if (!string.IsNullOrEmpty(profileData.ProfilePictureBase64) && !string.IsNullOrEmpty(profileData.ProfilePictureFileName))
      {
        try
        {
          string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));
          string assetsDirectory = Path.Combine(userDirectory, "assets");
          Directory.CreateDirectory(assetsDirectory);

          // Prefix files with username_ to reduce collisions
          string savedFile = await ImageService.SaveAndCompressFromBase64Async(
              profileData.ProfilePictureBase64,
              profileData.ProfilePictureFileName,
              assetsDirectory,
              SanitizeDirectoryName(username) + "_");

          // Store secure endpoint URL
          user.ProfilePictureUrl = $"/api/users/{SanitizeDirectoryName(username)}/assets/{savedFile}";
        }
        catch (Exception ex)
        {
          _logger.LogError(ex, "Error saving profile picture for user: {Username}", username);
          // Continue without failing entire update
        }
      }

      return await UpdateUserAsync(user);
    }

    private static string NormalizeProfilePictureUrl(string username, string raw)
    {
      if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
      if (raw.StartsWith("/api/users/", StringComparison.OrdinalIgnoreCase)) return raw;
      // Legacy path like /Content/users/{username}/assets/{file}
      var fileName = Path.GetFileName(raw);
      if (string.IsNullOrEmpty(fileName)) return string.Empty;
      var safeUser = new string((username ?? string.Empty).Where(c => !Path.GetInvalidFileNameChars().Contains(c)).ToArray());
      return $"/api/users/{safeUser}/assets/{fileName}";
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
