using System.IO;
using System.Security.Claims;
using System.Text.Json;
using FileBlogSystem.Models;

namespace FileBlogSystem.Services;

public class UserService
{
  private readonly DirectoryInfo _usersDirectory;
  private readonly PasswordService _passwordService;
  private readonly JwtService _jwtService;

  public UserService(PasswordService passwordService, JwtService jwtService, IConfiguration configuration, IWebHostEnvironment env)
  {
    _passwordService = passwordService;
    _jwtService = jwtService;

    // Get content directory from configuration
    string? contentRoot = configuration["ContentDirectory"] ?? "Content";

    string usersDirectoryPath = Path.Combine(env.ContentRootPath, contentRoot, "users");

    Console.WriteLine($"Users directory path: {usersDirectoryPath}");

    // Create the directory if it doesn't exist
    if (!Directory.Exists(usersDirectoryPath))
    {
      Directory.CreateDirectory(usersDirectoryPath);
    }
    _usersDirectory = new DirectoryInfo(usersDirectoryPath);
  }

  public async Task<IResult> LoginUser(string username, string password)
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

    await File.WriteAllTextAsync(profileFilePath, JsonSerializer.Serialize(user, new JsonSerializerOptions
    {
      WriteIndented = true
    }));

    string token = _jwtService.GenerateToken(user);

    var publicUser = new
    {
      user.Username,
      user.Email,
      user.Role,
      user.CreatedAt
    };

    return Results.Ok(new
    {
      token,
      user = publicUser
    });
  }

  public string CreateUserDirectory(string username)
  {
    string sanitizedUsername = SanitizeDirectoryName(username);
    string userDirectoryPath = Path.Combine(_usersDirectory.FullName, sanitizedUsername);

    if (!Directory.Exists(userDirectoryPath))
    {
      Directory.CreateDirectory(userDirectoryPath);
    }

    return userDirectoryPath;
  }

  private string SanitizeDirectoryName(string name)
  {
    char[] invalidChars = Path.GetInvalidFileNameChars();
    return string.Join("_", name.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries)).TrimEnd('.');
  }

  public async Task<IResult> RegisterUser(string username, string password, string email, string role = "Author")
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

    string profileJson = JsonSerializer.Serialize(user, new JsonSerializerOptions
    {
      WriteIndented = true
    });

    await File.WriteAllTextAsync(Path.Combine(userDir, "profile.json"), profileJson);

    string token = _jwtService.GenerateToken(user);

    var publicUser = new
    {
      user.Username,
      user.Email,
      user.Role,
      user.CreatedAt
    };

    return Results.Created($"/users/{username}", new
    {
      token,
      user = publicUser
    });
  }
  public bool UserDirectoryExists(string username)
  {
    string sanitizedUsername = SanitizeDirectoryName(username);
    string userDirectoryPath = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
    return Directory.Exists(userDirectoryPath);
  }

  // Get a user profile by username
  public async Task<IResult> GetUserProfile(string username)
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

    // Return a public version of the user (without password hash)
    var publicUser = new
    {
      user.Username,
      user.Email,
      user.Role,
      user.CreatedAt
    };

    return Results.Ok(publicUser);
  }

  // Update user profile
  public async Task<IResult> UpdateUserProfile(string username, string? email = null, string? role = null)
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

    // Update fields if provided
    if (!string.IsNullOrEmpty(email))
    {
      user.Email = email;
    }

    if (!string.IsNullOrEmpty(role))
    {
      user.Role = role;
    }

    // Save updated profile
    await File.WriteAllTextAsync(profilePath, JsonSerializer.Serialize(user, new JsonSerializerOptions
    {
      WriteIndented = true
    }));

    // Return a public version of the updated user
    var publicUser = new
    {
      user.Username,
      user.Email,
      user.Role,
      user.CreatedAt
    };

    return Results.Ok(publicUser);
  }
  public bool IsAdmin(ClaimsPrincipal user)
  {
    return user.IsInRole("Admin") || user.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value == "Admin");
  }
  public async Task<IResult> PromoteUserToAdmin(string targetUsername, string requestedBy)
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

}