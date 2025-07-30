using System.Security.Claims;
using System.Text.Json;
using System.ComponentModel.DataAnnotations;
using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
namespace FileBlogSystem.Services;

public class UserService : IUserService
{
  private readonly DirectoryInfo _usersDirectory;
  private readonly PasswordService _passwordService;
  private readonly JwtService _jwtService;

  public UserService(PasswordService passwordService, JwtService jwtService, IConfiguration configuration, IWebHostEnvironment env)
  {
    _passwordService = passwordService;
    _jwtService = jwtService;

    string? contentRoot = configuration["ContentDirectory"] ?? "Content";
    string usersDirectoryPath = Path.Combine(env.ContentRootPath, contentRoot, "users");

    Console.WriteLine($"Users directory path: {usersDirectoryPath}");

    if (!Directory.Exists(usersDirectoryPath))
    {
      Directory.CreateDirectory(usersDirectoryPath);
    }

    _usersDirectory = new DirectoryInfo(usersDirectoryPath);
  }

  public async Task<IResult> LoginUser(string username, string password)
  {
    try
    {
      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDirectoryPath = Path.Combine(_usersDirectory.FullName, sanitizedUsername);

      if (!Directory.Exists(userDirectoryPath))
      {
        return Results.Unauthorized();
      }

      string profileFilePath = Path.Combine(userDirectoryPath, "profile.json");
      if (!File.Exists(profileFilePath))
      {
        return Results.Problem("User profile not found", statusCode: StatusCodes.Status500InternalServerError);
      }

      string profileJson = await File.ReadAllTextAsync(profileFilePath);
      var user = JsonSerializer.Deserialize<User>(profileJson);

      if (user == null || string.IsNullOrEmpty(user.PasswordHash))
      {
        return Results.Problem("Invalid user profile data", statusCode: StatusCodes.Status500InternalServerError);
      }

      if (!user.IsActive)
      {
        return Results.Problem("Account is deleted", statusCode: 403);
      }

      bool isPasswordValid = _passwordService.VerifyPassword(password, user.PasswordHash);
      if (!isPasswordValid)
      {
        return Results.Problem("Invalid username or password");
      }

      await File.WriteAllTextAsync(profileFilePath, JsonSerializer.Serialize(user, new JsonSerializerOptions { WriteIndented = true }));

      string token = _jwtService.GenerateToken(user);

      var publicUser = new
      {
        user.Username,
        user.Email,
        user.Role,
        user.CreatedAt,
        user.ProfilePictureUrl
      };

      return Results.Ok(new { token, user = publicUser });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }

  public string CreateUserDirectory(string username)
  {
    try
    {
      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDirectoryPath = Path.Combine(_usersDirectory.FullName, sanitizedUsername);

      if (!Directory.Exists(userDirectoryPath))
      {
        Directory.CreateDirectory(userDirectoryPath);
      }

      return userDirectoryPath;
    }
    catch (Exception ex)
    {
      throw new Exception($"Failed to create user directory: {ex.Message}");
    }
  }

  private string SanitizeDirectoryName(string name)
  {
    char[] invalidChars = Path.GetInvalidFileNameChars();
    return string.Join("_", name.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries)).TrimEnd('.');
  }

  public async Task<IResult> RegisterUser(string username, string password, string email, string role = "Author")
  {
    try
    {
      if (UserDirectoryExists(username))
      {
        return Results.Conflict(new { message = "Username already exists" });
      }

      string userDir = CreateUserDirectory(username);
      string passwordHash = _passwordService.HashPassword(password);

      var user = new User
      {
        Username = username,
        Email = email,
        PasswordHash = passwordHash,
        Role = role,
        CreatedAt = DateTime.UtcNow
      };

      string profileJson = JsonSerializer.Serialize(user, new JsonSerializerOptions { WriteIndented = true });
      await File.WriteAllTextAsync(Path.Combine(userDir, "profile.json"), profileJson);

      string token = _jwtService.GenerateToken(user);

      var publicUser = new
      {
        user.Username,
        user.Email,
        user.Role,
        user.CreatedAt,
        user.ProfilePictureUrl
      };

      return Results.Created($"/users/{username}", new { token, user = publicUser });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }

  public bool UserDirectoryExists(string username)
  {
    string sanitizedUsername = SanitizeDirectoryName(username);
    string userDirectoryPath = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
    return Directory.Exists(userDirectoryPath);
  }

  public async Task<IResult> GetUserProfile(string username, string? requestingUser = null)
  {
    try
    {
      if (!UserDirectoryExists(username))
      {
        return Results.NotFound(new { message = "User not found" });
      }

      string sanitizedUsername = SanitizeDirectoryName(username);
      string profilePath = Path.Combine(_usersDirectory.FullName, sanitizedUsername, "profile.json");

      if (!File.Exists(profilePath))
      {
        return Results.NotFound(new { message = "User profile not found" });
      }

      string profileJson = await File.ReadAllTextAsync(profilePath);
      var user = JsonSerializer.Deserialize<User>(profileJson);

      if (user == null)
      {
        return Results.Problem("Invalid user profile data", statusCode: StatusCodes.Status500InternalServerError);
      }

      if (!user.IsActive)
      {
        return Results.Problem("Account is deleted", statusCode: 403);
      }

      bool isOwnProfile = !string.IsNullOrEmpty(requestingUser) && username.Equals(requestingUser, StringComparison.OrdinalIgnoreCase);

      if (isOwnProfile)
      {
        var privateProfile = new
        {
          user.Username,
          user.Email, // Include email for own profile
          user.Role,
          user.CreatedAt,
          user.ProfilePictureUrl,
          user.Bio,
          PostsCount = GetUserPostsCount(sanitizedUsername)
        };
        return Results.Ok(privateProfile);
      }
      else
      {
        // Return public profile without email
        var publicProfile = new
        {
          user.Username,
          user.Role,
          user.CreatedAt,
          user.ProfilePictureUrl,
          user.Bio,
          PostsCount = GetUserPostsCount(sanitizedUsername)
        };
        return Results.Ok(publicProfile);
      }
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }
  public async Task<IResult> UpdateUserProfile(string username, UpdateProfileRequest request)
  {
    try
    {
      if (!UserDirectoryExists(username))
        return Results.NotFound(new { message = "User not found" });

      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDir = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
      string profilePath = Path.Combine(userDir, "profile.json");

      if (!File.Exists(profilePath))
        return Results.NotFound(new { message = "User profile not found" });

      var user = await LoadUserProfile(profilePath);
      if (user == null)
        return Results.Problem("Invalid user profile data", statusCode: 500);
      if (!user.IsActive)
        return Results.Problem("Account is deleted", statusCode: 403);

      if (request.ConfirmPassword != null && !string.IsNullOrWhiteSpace(request.ConfirmPassword))
      {
        // Verify current password
        bool isPasswordValid = _passwordService.VerifyPassword(request.ConfirmPassword, user.PasswordHash);
        if (!isPasswordValid)
          return Results.BadRequest(new { message = "Current password is incorrect" });
      }
      // Update fields
      if (!string.IsNullOrWhiteSpace(request.Email) && request.Email != user.Email)
      {
        // Validate email format if necessary
        if (!new EmailAddressAttribute().IsValid(request.Email))
          return Results.BadRequest(new { message = "Invalid email format" });
      }
      if (!string.IsNullOrWhiteSpace(request.Email))
        user.Email = request.Email.Trim();

      // Handle bio updates
      if (request.Bio != null)
        user.Bio = request.Bio.Trim();

      if (!string.IsNullOrWhiteSpace(request.ProfilePictureBase64) && !string.IsNullOrWhiteSpace(request.ProfilePictureFileName))
      {
        string profilePictureUrl = await SaveProfilePictureAsync(username, request.ProfilePictureBase64, request.ProfilePictureFileName);
        user.ProfilePictureUrl = profilePictureUrl;
      }

      await SaveUserProfile(profilePath, user);

      var publicUser = new
      {
        user.Username,
        user.Email,
        user.Role,
        user.CreatedAt,
        user.ProfilePictureUrl,
        user.Bio
      };

      return Results.Ok(publicUser);
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: 500);
    }
  }

  public async Task<IResult> UpdatePassword(string username, string currentPassword, string newPassword)
  {
    try
    {
      if (!UserDirectoryExists(username))
        return Results.NotFound(new { message = "User not found" });

      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDir = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
      string profilePath = Path.Combine(userDir, "profile.json");

      if (!File.Exists(profilePath))
        return Results.NotFound(new { message = "User profile not found" });

      var user = await LoadUserProfile(profilePath);
      if (user == null)
        return Results.Problem("Invalid user profile data", statusCode: 500);
      if (!user.IsActive)
        return Results.Problem("Account is deleted", statusCode: 403);

      // Verify current password
      bool isPasswordValid = _passwordService.VerifyPassword(currentPassword, user.PasswordHash);
      if (!isPasswordValid)
        return Results.BadRequest(new { message = "Current password is incorrect" });

      // Update password
      user.PasswordHash = _passwordService.HashPassword(newPassword);

      await SaveUserProfile(profilePath, user);

      return Results.Ok(new { message = "Password updated successfully" });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: 500);
    }
  }

  public bool IsAdmin(ClaimsPrincipal user)
  {
    return user.IsInRole("Admin") || user.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value == "Admin");
  }

  private async Task<User?> LoadUserProfile(string path)
  {
    string json = await File.ReadAllTextAsync(path);
    return JsonSerializer.Deserialize<User>(json);
  }

  private async Task SaveUserProfile(string path, User user)
  {
    string updatedJson = JsonSerializer.Serialize(user, new JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(path, updatedJson);
  }

  private async Task<string> SaveProfilePictureAsync(string username, string base64Image, string originalFileName)
  {
    string sanitizedUsername = SanitizeDirectoryName(username);
    string userDir = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
    string assetsDir = Path.Combine(userDir, "assets");

    var savedFileName = await ImageService.SaveAndCompressFromBase64Async(
        base64Image,
        originalFileName,
        assetsDir,
        filePrefix: $"{sanitizedUsername}_"
    );

    return $"/Content/users/{sanitizedUsername}/assets/{savedFileName}";
  }


  private int GetUserPostsCount(string sanitizedUsername)
  {
    try
    {
      string postsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Content", "posts");
      if (!Directory.Exists(postsDirectory))
      {
        return 0;
      }

      var postDirectories = Directory.GetDirectories(postsDirectory);
      int count = 0;

      foreach (var postDir in postDirectories)
      {
        string metaFile = Path.Combine(postDir, "meta.json");
        if (!File.Exists(metaFile)) continue;

        try
        {
          string metaJson = File.ReadAllText(metaFile);
          if (string.IsNullOrWhiteSpace(metaJson))
          {
            continue;
          }

          // Configure JsonSerializer to handle camelCase property names
          var options = new JsonSerializerOptions
          {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
          };

          var post = JsonSerializer.Deserialize<Post>(metaJson, options);

          if (post == null || string.IsNullOrEmpty(post.Author))
          {
            continue;
          }

          if (post.Author.Equals(sanitizedUsername, StringComparison.OrdinalIgnoreCase) &&
              post.IsPublished)
          {
            count++;
          }
        }
        catch (JsonException jsonEx)
        {
          Console.WriteLine($"JSON error reading post meta for count in {postDir}: {jsonEx.Message}");
        }
        catch (Exception ex)
        {
          Console.WriteLine($"Error reading post meta for count: {ex.Message}");
        }
      }

      return count;
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error getting user posts count: {ex.Message}");
      return 0;
    }
  }
  public async Task<IResult> DeleteUser(string username)
  {
    try
    {
      if (!UserDirectoryExists(username))
        return await Task.FromResult(Results.NotFound(new { message = "User not found" }));

      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDir = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
      string profilePath = Path.Combine(userDir, "profile.json");

      if (File.Exists(profilePath))
      {
        var user = await LoadUserProfile(profilePath);
        if (user == null)
          return Results.Problem("Invalid user profile data", statusCode: 500);

        if (!user.IsActive)
        {
          return Results.Problem("Account is deleted", statusCode: 403);
        }

        user.IsActive = false;
        await SaveUserProfile(profilePath, user);
      }

      return Results.Ok(new { message = "User deleted successfully" });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }
  // Step 1: Verify OTP
  public async Task<IResult> VerifyOtp(string username, string otpCode)
  {
    try
    {
      if (!UserDirectoryExists(username))
        return Results.NotFound(new { message = "User not found" });

      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDir = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
      string profilePath = Path.Combine(userDir, "profile.json");

      if (!File.Exists(profilePath))
        return Results.NotFound(new { message = "User profile not found" });

      var user = await LoadUserProfile(profilePath);
      if (user == null)
        return Results.Problem("Invalid user profile data", statusCode: 500);

      if (!user.IsActive)
        return Results.Problem("Account is deleted", statusCode: 403);

      // Check OTP code and expiration
      if (string.IsNullOrEmpty(user.ResetToken) || user.ResetTokenExpiration == null)
        return Results.BadRequest(new { message = "No OTP code found. Please request a new one." });

      if (user.ResetTokenExpiration < DateTime.UtcNow)
        return Results.BadRequest(new { message = "OTP code has expired. Please request a new one." });

      if (user.ResetToken != otpCode)
        return Results.BadRequest(new { message = "Invalid OTP code." });

      // OTP is valid, mark as verified
      user.ResetTokenVerified = true;
      await SaveUserProfile(profilePath, user);

      return Results.Ok(new { message = "OTP verified. You may now reset your password." });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }

  // Step 2: Reset Password (after OTP verified)
  public async Task<IResult> ResetPassword(string username, string newPassword)
  {
    try
    {
      if (!UserDirectoryExists(username))
        return Results.NotFound(new { message = "User not found" });

      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDir = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
      string profilePath = Path.Combine(userDir, "profile.json");

      if (!File.Exists(profilePath))
        return Results.NotFound(new { message = "User profile not found" });

      var user = await LoadUserProfile(profilePath);
      if (user == null)
        return Results.Problem("Invalid user profile data", statusCode: 500);

      if (!user.IsActive)
        return Results.Problem("Account is deleted", statusCode: 403);

      // Check that OTP was verified
      if (user.ResetTokenVerified != true)
        return Results.BadRequest(new { message = "OTP not verified. Please verify OTP first." });

      // Reset password
      user.PasswordHash = _passwordService.HashPassword(newPassword);
      user.ResetToken = null;
      user.ResetTokenExpiration = null;
      user.ResetTokenVerified = null;

      await SaveUserProfile(profilePath, user);

      return Results.Ok(new { message = "Password reset successfully" });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }
  public async Task<IResult> ForgotPassword(string username, string email, EmailService emailService)
  {
    try
    {
      if (!UserDirectoryExists(username))
        return Results.NotFound(new { message = "User not found" });
      string sanitizedUsername = SanitizeDirectoryName(username);
      string userDir = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
      string profilePath = Path.Combine(userDir, "profile.json");

      if (!File.Exists(profilePath))
        return Results.NotFound(new { message = "User profile not found" });

      var user = await LoadUserProfile(profilePath);
      if (user == null)
        return Results.Problem("Invalid user profile data", statusCode: 500);

      if (!user.IsActive)
        return Results.Problem("Account is deleted", statusCode: 403);

      if (user.Email != email)
        return Results.BadRequest(new { message = "Email does not match the registered email for this user" });

      string resetToken = _passwordService.GenerateAndStoreResetToken(user);
      await SaveUserProfile(profilePath, user); // Make sure token is persisted

      await emailService.SendOtpEmail(user.Email, user.Username, resetToken);

      return Results.Ok(new { message = "OTP code sent to your email" });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }
}
