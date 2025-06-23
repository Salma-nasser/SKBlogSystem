using System.Text.Json;
using FileBlogSystem.Models;

namespace FileBlogSystem.Services;

public class BlogPostService
{
  private readonly string _rootPath = Path.Combine("Content", "posts");

  public BlogPostService()
  {
    if (!Directory.Exists(_rootPath))
      Directory.CreateDirectory(_rootPath);
  }

  public IEnumerable<Post> GetAllPosts()
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      var post = LoadPost(dir);
      if (post != null && post.IsPublished)
        yield return post;
    }
  }

  public IEnumerable<Post> GetPostsByCategory(string category)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      var post = LoadPost(dir);
      if (post != null && post.IsPublished && post.Categories.Contains(category, StringComparer.OrdinalIgnoreCase))
        yield return post;
    }
  }

  public IEnumerable<Post> GetPostsByTag(string tag)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      var post = LoadPost(dir);
      if (post != null && post.IsPublished && post.Tags.Contains(tag, StringComparer.OrdinalIgnoreCase))
        yield return post;
    }
  }

  public Post? GetPostBySlug(string slug)
  {
    if (!Directory.Exists(_rootPath)) return null;

    var folder = Directory.GetDirectories(_rootPath)
        .FirstOrDefault(dir => dir.EndsWith($"-{slug}"));

    if (folder == null) return null;

    var post = LoadPost(folder);
    return post;
  }

  public IEnumerable<Post> GetUserDrafts(string username)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      var post = LoadPost(dir);
      if (post != null && !post.IsPublished && post.Author.Equals(username, StringComparison.OrdinalIgnoreCase))
        yield return post;
    }
  }

  private Post? LoadPost(string folder)
  {
    var metaPath = Path.Combine(folder, "meta.json");
    var bodyPath = Path.Combine(folder, "content.md");

    if (!File.Exists(metaPath) || !File.Exists(bodyPath))
      return null;

    var metaJson = File.ReadAllText(metaPath);
    using var doc = JsonDocument.Parse(metaJson);

    var title = doc.RootElement.GetProperty("Title").GetString() ?? "";
    var description = doc.RootElement.GetProperty("Description").GetString() ?? "";
    var publishedDate = doc.RootElement.GetProperty("PublishedDate").GetDateTime();
    DateTime? lastModified = doc.RootElement.TryGetProperty("ModifiedDate", out var modProp) && modProp.ValueKind != JsonValueKind.Null
        ? modProp.GetDateTime()
        : null;

    var author = doc.RootElement.GetProperty("AuthorUsername").GetString() ?? "";

    var tags = doc.RootElement.TryGetProperty("Tags", out var tagsProp)
        ? tagsProp.EnumerateArray().Select(t => t.GetString() ?? "").ToList()
        : new List<string>();

    var categories = doc.RootElement.TryGetProperty("Categories", out var catsProp)
        ? catsProp.EnumerateArray().Select(c => c.GetString() ?? "").ToList()
        : new List<string>();

    var slug = doc.RootElement.TryGetProperty("Slug", out var slugProp)
        ? slugProp.GetString() ?? folder.Substring(_rootPath.Length + 1)
        : folder.Substring(_rootPath.Length + 1);

    var isPublished = doc.RootElement.TryGetProperty("IsPublished", out var publishedProp)
        ? publishedProp.GetBoolean()
        : true;

    DateTime? scheduledDate = null;
    if (doc.RootElement.TryGetProperty("ScheduledDate", out var schedProp) && schedProp.ValueKind != JsonValueKind.Null && schedProp.ValueKind != JsonValueKind.Undefined)
    {
      scheduledDate = schedProp.GetDateTime();
    }

    var body = File.ReadAllText(bodyPath);

    return new Post(title, description, body, author, publishedDate, lastModified ?? publishedDate, tags, categories, slug, isPublished, scheduledDate);
  }

  public void CreatePost(CreatePostRequest request, string authorUsername)
  {
    var date = DateTime.UtcNow;
    var slug = request.CustomUrl ?? request.Title.Replace(" ", "-").ToLowerInvariant();
    var folder = Path.Combine(_rootPath, $"{date:yyyy-MM-dd}-{slug}");

    // Check for slug collision
    if (Directory.GetDirectories(_rootPath).Any(d => d.EndsWith(slug, StringComparison.OrdinalIgnoreCase)))
      throw new Exception("A post with the same slug already exists.");

    Directory.CreateDirectory(folder);
    Directory.CreateDirectory(Path.Combine(folder, "assets"));

    var postMeta = new
    {
      request.Title,
      request.Description,
      request.Body,
      request.CustomUrl,
      AuthorUsername = authorUsername,
      Tags = request.Tags,
      Categories = request.Categories,
      PublishedDate = date,
      ModifiedDate = date,
      Slug = slug,
      IsPublished = request.IsPublished, // Will default to false if not provided, adjust here if needed
      ScheduledDate = request.ScheduledDate
    };

    var meta = JsonSerializer.Serialize(postMeta, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(Path.Combine(folder, "meta.json"), meta);
    File.WriteAllText(Path.Combine(folder, "content.md"), request.Body);
  }

  public bool ModifyPost(string slug, CreatePostRequest updatedData, string currentUsername, out string message)
  {
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
    var root = doc.RootElement;

    var authorUsername = root.GetProperty("AuthorUsername").GetString();
    var publishedDate = root.GetProperty("PublishedDate").GetDateTime();
    var lastModified = DateTime.UtcNow;

    if (!string.Equals(authorUsername, currentUsername, StringComparison.OrdinalIgnoreCase))
    {
      message = "Unauthorized: only the author can modify this post.";
      return false;
    }

    // Preserve old values if not provided in update
    var title = string.IsNullOrWhiteSpace(updatedData.Title) ? root.GetProperty("Title").GetString() : updatedData.Title;
    var description = string.IsNullOrWhiteSpace(updatedData.Description) ? root.GetProperty("Description").GetString() : updatedData.Description;
    var customUrl = string.IsNullOrWhiteSpace(updatedData.CustomUrl) ? root.GetProperty("CustomUrl").GetString() : updatedData.CustomUrl;

    var tags = (updatedData.Tags == null || updatedData.Tags.Count == 0)
        ? root.GetProperty("Tags").EnumerateArray().Select(t => t.GetString() ?? "").ToList()
        : updatedData.Tags;

    var categories = (updatedData.Categories == null || updatedData.Categories.Count == 0)
        ? root.GetProperty("Categories").EnumerateArray().Select(c => c.GetString() ?? "").ToList()
        : updatedData.Categories;

    var isPublished = updatedData.IsPublished;

    if (updatedData.IsPublished == null)
    {
      if (root.TryGetProperty("IsPublished", out var publishedProp))
        isPublished = publishedProp.GetBoolean();
      else
        isPublished = true; // Default to true if completely missing
    }

    DateTime? scheduledDate = null;

    if (updatedData.ScheduledDate.HasValue)
    {
      scheduledDate = updatedData.ScheduledDate;
    }
    else if (root.TryGetProperty("ScheduledDate", out var schedProp) && schedProp.ValueKind != JsonValueKind.Null && schedProp.ValueKind != JsonValueKind.Undefined)
    {
      scheduledDate = schedProp.GetDateTime();
    }

    var updatedMeta = new
    {
      Title = title,
      Description = description,
      Body = updatedData.Body ?? File.ReadAllText(bodyPath),
      CustomUrl = customUrl,
      AuthorUsername = authorUsername,
      Tags = tags,
      Categories = categories,
      PublishedDate = publishedDate,
      ModifiedDate = lastModified,
      Slug = slug,
      IsPublished = isPublished,
      ScheduledDate = scheduledDate
    };

    var newMeta = JsonSerializer.Serialize(updatedMeta, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(metaPath, newMeta);

    // Update body only if a new one was provided
    if (!string.IsNullOrWhiteSpace(updatedData.Body))
      File.WriteAllText(bodyPath, updatedData.Body);

    message = "Post updated successfully.";
    return true;
  }
  public bool PublishPost(string slug, string currentUsername, out string message)
  {
    var folder = Directory.GetDirectories(_rootPath)
        .FirstOrDefault(dir => dir.EndsWith(slug, StringComparison.OrdinalIgnoreCase));

    if (folder == null)
    {
      message = "Post not found.";
      return false;
    }

    var metaPath = Path.Combine(folder, "meta.json");

    if (!File.Exists(metaPath))
    {
      message = "Post metadata is missing.";
      return false;
    }

    var metaJson = File.ReadAllText(metaPath);
    using var doc = JsonDocument.Parse(metaJson);
    var root = doc.RootElement;

    var authorUsername = root.GetProperty("AuthorUsername").GetString();
    if (!string.Equals(authorUsername, currentUsername, StringComparison.OrdinalIgnoreCase))
    {
      message = "Unauthorized: only the author can publish this post.";
      return false;
    }

    var publishedDate = root.GetProperty("PublishedDate").GetDateTime();
    var lastModified = DateTime.UtcNow;

    // Only allow publish if not scheduled
    if (root.TryGetProperty("ScheduledDate", out var schedProp) && schedProp.ValueKind != JsonValueKind.Null && schedProp.ValueKind != JsonValueKind.Undefined)
    {
      message = "Cannot publish a scheduled post directly.";
      return false;
    }

    var updatedMeta = new
    {
      Title = root.GetProperty("Title").GetString(),
      Description = root.GetProperty("Description").GetString(),
      Body = root.GetProperty("Body").GetString(),
      CustomUrl = root.GetProperty("CustomUrl").GetString(),
      AuthorUsername = authorUsername,
      Tags = root.GetProperty("Tags").EnumerateArray().Select(t => t.GetString() ?? "").ToList(),
      Categories = root.GetProperty("Categories").EnumerateArray().Select(c => c.GetString() ?? "").ToList(),
      PublishedDate = publishedDate,
      ModifiedDate = lastModified,
      Slug = slug,
      IsPublished = true
    };

    var newMeta = JsonSerializer.Serialize(updatedMeta, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(metaPath, newMeta);

    message = "Post published successfully.";
    return true;
  }

}
