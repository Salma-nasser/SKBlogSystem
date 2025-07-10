using System.Text.Json;
using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
namespace FileBlogSystem.Services;

public class AdminService : IAdminService
{
  private readonly DirectoryInfo _usersDirectory;
  private readonly PasswordService _passwordService;
  private readonly JwtService _jwtService;

  public AdminService(IConfiguration configuration, PasswordService passwordService, JwtService jwtService)
  {
    string usersPath = Path.Combine(Directory.GetCurrentDirectory(), "Content", "users");
    _usersDirectory = new DirectoryInfo(usersPath);
    _passwordService = passwordService;
    _jwtService = jwtService;
  }

  private bool UserDirectoryExists(string username)
  {
    string sanitizedUsername = SanitizeDirectoryName(username);
    string userDirectoryPath = Path.Combine(_usersDirectory.FullName, sanitizedUsername);
    return Directory.Exists(userDirectoryPath);
  }

  private string SanitizeDirectoryName(string directoryName)
  {
    foreach (char invalidChar in Path.GetInvalidFileNameChars())
    {
      directoryName = directoryName.Replace(invalidChar, '_');
    }
    return directoryName;
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
}