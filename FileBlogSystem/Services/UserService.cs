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

      bool isPasswordValid = _passwordService.VerifyPassword(password, user.PasswordHash);
      if (!isPasswordValid)
      {
        return Results.Unauthorized();
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

  public async Task<IResult> GetUserProfile(string username)
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

      var publicUser = new
      {
        user.Username,
        user.Email,
        user.Role,
        user.CreatedAt,
        user.ProfilePictureUrl

      };

      return Results.Ok(publicUser);
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
        user.ProfilePictureUrl
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

  public async Task<IResult> PromoteUserToAdmin(string targetUsername, string requestedBy)
  {
    try
    {
      if (!UserDirectoryExists(targetUsername))
      {
        return Results.NotFound(new { message = "User not found." });
      }

      if (targetUsername.Equals(requestedBy, StringComparison.OrdinalIgnoreCase))
      {
        return Results.BadRequest(new { message = "You cannot promote yourself." });
      }

      string sanitizedUsername = SanitizeDirectoryName(targetUsername);
      string profilePath = Path.Combine(_usersDirectory.FullName, sanitizedUsername, "profile.json");

      if (!File.Exists(profilePath))
      {
        return Results.NotFound(new { message = "User profile not found." });
      }

      string profileJson = await File.ReadAllTextAsync(profilePath);
      var user = JsonSerializer.Deserialize<User>(profileJson);

      if (user == null)
      {
        return Results.Problem("Invalid user profile data", statusCode: StatusCodes.Status500InternalServerError);
      }

      if (user.Role == "Admin")
      {
        return Results.BadRequest(new { message = "User is already an admin." });
      }

      user.Role = "Admin";
      await File.WriteAllTextAsync(profilePath, JsonSerializer.Serialize(user, new JsonSerializerOptions { WriteIndented = true }));

      return Results.Ok(new { message = $"{targetUsername} has been promoted to Admin." });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
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
    Directory.CreateDirectory(assetsDir);

    string cleanFileName = $"{username}_{Path.GetFileName(originalFileName)}";
    string filePath = Path.Combine(assetsDir, cleanFileName);

    byte[] imageBytes = Convert.FromBase64String(base64Image);
    await File.WriteAllBytesAsync(filePath, imageBytes);

    return $"/Content/users/{username}/assets/{cleanFileName}";
  }
}