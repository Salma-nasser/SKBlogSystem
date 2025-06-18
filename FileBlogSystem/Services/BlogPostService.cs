using System.Text.Json;
using FileBlogSystem.Models;

namespace FileBlogSystem.Services;

public class BlogPostService
{
  private readonly string _rootPath = Path.Combine("Content", "posts");

  public IEnumerable<Post> GetAllPosts()
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      var metaPath = Path.Combine(dir, "meta.json");
      var bodyPath = Path.Combine(dir, "content.md");

      if (File.Exists(metaPath) && File.Exists(bodyPath))
      {
        var meta = JsonSerializer.Deserialize<CreatePostRequest>(File.ReadAllText(metaPath));
        var body = File.ReadAllText(bodyPath);

        var metaJson = File.ReadAllText(metaPath);
        using var doc = JsonDocument.Parse(metaJson);

        var title = doc.RootElement.GetProperty("Title").GetString();
        var description = doc.RootElement.GetProperty("Description").GetString();
        var publishedDate = doc.RootElement.GetProperty("PublishedDate").GetDateTime();
        var authorJson = doc.RootElement.GetProperty("Author");
        var author = new User
        {
          Username = authorJson.GetProperty("Username").GetString() ?? string.Empty,
          Role = authorJson.GetProperty("Role").GetString() ?? string.Empty,
        };

        if (meta != null)
        {
          yield return new Post(
              meta.Title,
              meta.Description,
              body,
              author,
              publishedDate
          );
        }
      }
    }
  }

  public void CreatePost(CreatePostRequest request, User author)
  {
    var date = DateTime.UtcNow;
    var slug = request.CustomUrl ?? request.Title.Replace(" ", "-").ToLowerInvariant();
    var folder = Path.Combine(_rootPath, $"{date:yyyy-MM-dd}-{slug}");

    Directory.CreateDirectory(folder);
    Directory.CreateDirectory(Path.Combine(folder, "assets"));

    var postWithAuthor = new
    {
      request.Title,
      request.Description,
      request.Body,
      request.CustomUrl,
      Author = new
      {
        Username = author.Username,
        Email = author.Email,
        Role = author.Role,
        CreatedAt = author.CreatedAt
      },
      PublishedDate = date
    };

    var meta = JsonSerializer.Serialize(postWithAuthor, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(Path.Combine(folder, "meta.json"), meta);
    File.WriteAllText(Path.Combine(folder, "content.md"), request.Body);
  }
  public bool ModifyPost(string slug, CreatePostRequest updatedData, User currentUser, out string message)
  {
    // Find the post folder
    var folder = Directory.GetDirectories(_rootPath)
        .FirstOrDefault(dir => dir.EndsWith(slug, StringComparison.OrdinalIgnoreCase));

    if (folder == null)
    {
      message = "Post not found.";
      return false;
    }

    var metaPath = Path.Combine(folder, "meta.json");
    var bodyPath = Path.Combine(folder, "content.md");

    if (!File.Exists(metaPath) || !File.Exists(bodyPath))
    {
      message = "Post files are missing or corrupted.";
      return false;
    }

    var metaJson = File.ReadAllText(metaPath);
    using var doc = JsonDocument.Parse(metaJson);
    var authorUsername = doc.RootElement.GetProperty("Author").GetProperty("Username").GetString();

    if (!string.Equals(authorUsername, currentUser.Username, StringComparison.OrdinalIgnoreCase))
    {
      message = "Unauthorized: only the author can modify this post.";
      return false;
    }

    // Reuse the existing author info and publication date
    var publishedDate = doc.RootElement.GetProperty("PublishedDate").GetDateTime();
    var author = doc.RootElement.GetProperty("Author");

    var updatedMeta = new
    {
      updatedData.Title,
      updatedData.Description,
      updatedData.Body,
      updatedData.CustomUrl,
      Author = new
      {
        Username = author.GetProperty("Username").GetString(),
        Email = author.GetProperty("Email").GetString(),
        Role = author.GetProperty("Role").GetString(),
        CreatedAt = author.GetProperty("CreatedAt").GetDateTime()
      },
      PublishedDate = publishedDate,
      ModifiedDate = DateTime.UtcNow
    };

    var newMeta = JsonSerializer.Serialize(updatedMeta, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(metaPath, newMeta);
    File.WriteAllText(bodyPath, updatedData.Body);

    message = "Post updated successfully.";
    return true;
  }
}