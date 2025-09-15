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

  public async Task<IResult> GetAllUsers()
  {
    try
    {
      var users = new List<object>();

      if (!_usersDirectory.Exists)
      {
        return Results.Ok(users);
      }

      foreach (var userDir in _usersDirectory.GetDirectories())
      {
        string profilePath = Path.Combine(userDir.FullName, "profile.json");

        if (File.Exists(profilePath))
        {
          string profileJson = await File.ReadAllTextAsync(profilePath);
          var user = JsonSerializer.Deserialize<User>(profileJson);

          if (user != null)
          {
            // Return only safe user information for admin view
            users.Add(new
            {
              Username = user.Username,
              Email = user.Email,
              Role = user.Role,
              CreatedAt = user.CreatedAt,
              LastLoginDate = user.LastLoginDate,
              IsActive = user.IsActive,
              Bio = user.Bio
            });
          }
        }
      }

      return Results.Ok(users);
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }

  // Backfill published post counts from Content/posts by scanning meta.json files
  public async Task<IResult> BackfillPublishedCounts(IBlogPostService blogService)
  {
    try
    {
      var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

      // Use blogService to get all posts including drafts and count published ones by author
      var allPosts = blogService.GetAllPostsIncludingDrafts();
      foreach (var p in allPosts)
      {
        if (p.IsPublished && !string.IsNullOrWhiteSpace(p.Author))
        {
          if (!counts.ContainsKey(p.Author)) counts[p.Author] = 0;
          counts[p.Author]++;
        }
      }

      int updated = 0;
      foreach (var kv in counts)
      {
        string username = kv.Key;
        int value = kv.Value;

        if (!UserDirectoryExists(username)) continue;

        string sanitizedUsername = SanitizeDirectoryName(username);
        string profilePath = Path.Combine(_usersDirectory.FullName, sanitizedUsername, "profile.json");
        if (!File.Exists(profilePath)) continue;

        var profileJson = await File.ReadAllTextAsync(profilePath);
        var user = JsonSerializer.Deserialize<User>(profileJson);
        if (user == null) continue;

        user.PublishedPostsCount = value;
        await File.WriteAllTextAsync(profilePath, JsonSerializer.Serialize(user, new JsonSerializerOptions { WriteIndented = true }));
        updated++;
      }

      return Results.Ok(new { message = "Backfill completed", authorsFound = counts.Count, profilesUpdated = updated });
    }
    catch (Exception ex)
    {
      return Results.Problem($"An error occurred during backfill: {ex.Message}", statusCode: StatusCodes.Status500InternalServerError);
    }
  }
}