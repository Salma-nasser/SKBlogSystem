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
      var bodyPath = Path.Combine(dir, "Content.md");

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
        Role = author.Role,
        CreatedAt = author.CreatedAt
      },
      PublishedDate = date
    };

    var meta = JsonSerializer.Serialize(postWithAuthor, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(Path.Combine(folder, "meta.json"), meta);
    File.WriteAllText(Path.Combine(folder, "content.md"), request.Body);
  }
}