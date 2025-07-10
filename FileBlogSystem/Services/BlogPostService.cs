using System.Text.Json;
using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;

namespace FileBlogSystem.Services;

public class BlogPostService : IBlogPostService
{
  private readonly string _rootPath;

  public BlogPostService(IConfiguration configuration, IWebHostEnvironment env)
  {
    string? contentRoot = configuration["ContentDirectory"] ?? "Content";
    _rootPath = Path.Combine(env.ContentRootPath, contentRoot, "posts");

    if (!Directory.Exists(_rootPath))
    {
      Directory.CreateDirectory(_rootPath);
      Console.WriteLine($"Created blog posts directory: {_rootPath}");
    }

    Console.WriteLine($"Blog posts directory path: {_rootPath}");
  }

  public IEnumerable<Post> GetPostsByCategory(string category, string currentUsername)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      Post? post = null;
      try
      {
        post = LoadPost(dir);
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error loading post from {dir}: {ex.Message}");
      }

      if (post != null && post.IsPublished && post.Categories.Contains(category, StringComparer.OrdinalIgnoreCase))
      {
        if (!string.IsNullOrEmpty(currentUsername))
        {
          post.LikedByCurrentUser = post.Likes.Contains(currentUsername, StringComparer.OrdinalIgnoreCase);
        }
        yield return post;
      }
    }
  }

  public IEnumerable<Post> GetPostsByTag(string tag, string currentUsername)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      Post? post = null;
      try
      {
        post = LoadPost(dir);
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error loading post from {dir}: {ex.Message}");
      }

      if (post != null && post.IsPublished && post.Tags.Contains(tag, StringComparer.OrdinalIgnoreCase))
      {
        if (!string.IsNullOrEmpty(currentUsername))
        {
          post.LikedByCurrentUser = post.Likes.Contains(currentUsername, StringComparer.OrdinalIgnoreCase);
        }
        yield return post;
      }
    }
  }

  public Post? GetPostBySlug(string slug, string currentUsername)
  {
    if (!Directory.Exists(_rootPath)) return null;

    foreach (var dir in Directory.GetDirectories(_rootPath))
    {
      try
      {
        var post = LoadPost(dir);
        if (post != null && post.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase))
        {
          if (!string.IsNullOrEmpty(currentUsername))
          {
            post.LikedByCurrentUser = post.Likes.Contains(currentUsername, StringComparer.OrdinalIgnoreCase);
          }
          return post;
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error loading post from {dir}: {ex.Message}");
      }
    }

    return null;
  }

  public IEnumerable<Post> GetUserDrafts(string username)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      Post? post = null;
      try
      {
        post = LoadPost(dir);
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error loading post from {dir}: {ex.Message}");
      }

      if (post != null && !post.IsPublished && post.Author.Equals(username, StringComparison.OrdinalIgnoreCase))
        yield return post;
    }
  }

  public IEnumerable<Post> GetPostsByUser(string username)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      Post? post = null;
      try
      {
        post = LoadPost(dir);
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error loading post from {dir}: {ex.Message}");
      }

      if (post != null && post.Author.Equals(username, StringComparison.OrdinalIgnoreCase) && post.IsPublished)
      {
        if (!string.IsNullOrEmpty(username))
        {
          post.LikedByCurrentUser = post.Likes.Contains(username, StringComparer.OrdinalIgnoreCase);
        }
        yield return post;
      }
    }
  }
  private Post? LoadPost(string folder)
  {
    try
    {
      var metaPath = Path.Combine(folder, "meta.json");
      var bodyPath = Path.Combine(folder, "content.md");

      if (!File.Exists(metaPath) || !File.Exists(bodyPath))
        return null;

      var metaJson = File.ReadAllText(metaPath);
      using var doc = JsonDocument.Parse(metaJson);

      var root = doc.RootElement;

      string GetSafeString(string propertyName)
      {
        // Try lowercase first, then uppercase (for backwards compatibility)
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.GetString() ?? "";
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.GetString() ?? "";
        return "";
      }

      DateTime GetSafeDateTime(string propertyName, DateTime defaultValue = default)
      {
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.GetDateTime();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.GetDateTime();
        return defaultValue;
      }

      DateTime? GetSafeNullableDateTime(string propertyName)
      {
        if (root.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null)
          return prop.GetDateTime();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp) && upperProp.ValueKind != JsonValueKind.Null)
          return upperProp.GetDateTime();
        return null;
      }

      bool GetSafeBool(string propertyName, bool defaultValue = false)
      {
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.GetBoolean();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.GetBoolean();
        return defaultValue;
      }

      List<string> GetSafeStringArray(string propertyName)
      {
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.EnumerateArray().Select(t => t.GetString() ?? "").ToList();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.EnumerateArray().Select(t => t.GetString() ?? "").ToList();
        return new List<string>();
      }

      int GetSafeInt(string propertyName, int defaultValue = 0)
      {
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.GetInt32();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.GetInt32();
        return defaultValue;
      }

      var title = GetSafeString("title");
      var description = GetSafeString("description");
      var author = GetSafeString("author");
      if (string.IsNullOrEmpty(author))
        author = GetSafeString("authorUsername"); // fallback for old format
      var slug = GetSafeString("slug");

      var publishedDate = GetSafeDateTime("publishedDate", DateTime.UtcNow);
      var lastModified = GetSafeNullableDateTime("lastModified") ?? GetSafeNullableDateTime("modifiedDate");
      var isPublished = GetSafeBool("isPublished");
      var scheduledDate = GetSafeNullableDateTime("scheduledDate");

      var tags = GetSafeStringArray("tags");
      var categories = GetSafeStringArray("categories");
      var images = GetSafeStringArray("images");
      var likes = GetSafeStringArray("likes");
      var commentCount = GetSafeInt("commentCount");

      var body = File.ReadAllText(bodyPath);

      var post = new Post(title, description, body, author, publishedDate, lastModified, tags, categories, slug, isPublished, scheduledDate);
      post.Images = images;
      post.Likes = likes;
      post.CommentCount = commentCount;

      return post;
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error reading post from {folder}: {ex.Message}");
      return null;
    }
  }

  public async Task<dynamic> CreatePostAsync(CreatePostRequest request, string authorUsername)
  {
    try
    {
      if (SlugExists(request.CustomUrl ?? request.Title.Replace(" ", "-").ToLowerInvariant()))
        throw new Exception("A post with the same slug already exists.");

      var date = DateTime.UtcNow;
      var slug = request.CustomUrl ?? request.Title.Replace(" ", "-").ToLowerInvariant();
      var folder = Path.Combine(_rootPath, $"{date:yyyy-MM-dd}-{slug}");

      Directory.CreateDirectory(folder);
      var assetsDirectory = Path.Combine(folder, "assets");
      Directory.CreateDirectory(assetsDirectory);

      var savedImages = new List<string>();

      if (request.Images != null && request.Images.Count > 0)
      {
        foreach (var image in request.Images)
        {
          if (image.Length > 0)
          {
            var fileName = Path.GetFileName(image.FileName);
            fileName = string.Join("_", fileName.Split(Path.GetInvalidFileNameChars()));

            string uniqueFileName = fileName;
            int counter = 1;
            while (File.Exists(Path.Combine(assetsDirectory, uniqueFileName)))
            {
              string fileNameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
              string extension = Path.GetExtension(fileName);
              uniqueFileName = $"{fileNameWithoutExt}_{counter++}{extension}";
            }

            var filePath = Path.Combine(assetsDirectory, uniqueFileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
              await image.CopyToAsync(stream);
            }

            savedImages.Add($"/assets/{uniqueFileName}");
          }
        }
      }

      if (request.ScheduledDate != null)
      {
        request.IsPublished = false;
        request.ScheduledDate = request.ScheduledDate.Value.ToUniversalTime();
      }

      var postMeta = new
      {
        request.Title,
        request.Description,
        request.CustomUrl,
        AuthorUsername = authorUsername,
        Tags = request.Tags,
        Categories = request.Categories,
        PublishedDate = date,
        ModifiedDate = (DateTime?)null,
        Slug = slug,
        IsPublished = request.IsPublished,
        ScheduledDate = request.ScheduledDate,
        Images = savedImages
      };

      var meta = JsonSerializer.Serialize(postMeta, new JsonSerializerOptions { WriteIndented = true });
      await File.WriteAllTextAsync(Path.Combine(folder, "meta.json"), meta);
      await File.WriteAllTextAsync(Path.Combine(folder, "content.md"), request.Body);

      return new
      {
        Id = folder,
        Slug = slug,
        Date = date,
        Title = request.Title,
        Description = request.Description,
        Body = request.Body,
        AuthorUsername = authorUsername,
        Tags = request.Tags,
        Categories = request.Categories,
        PublishedDate = date,
        IsPublished = request.IsPublished,
        ScheduledDate = request.ScheduledDate,
        Images = savedImages.Select(img => $"/{date:yyyy-MM-dd}-{slug}{img}")
      };
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error creating post: {ex.Message}");
      throw new Exception("An error occurred while creating the post.");
    }
  }
  public async Task<(bool Success, string Message)> ModifyPostAsync(string slug, CreatePostRequest updatedData, string currentUsername)
  {
    try
    {
      var folder = Directory.GetDirectories(_rootPath)
          .FirstOrDefault(dir => dir.EndsWith(slug, StringComparison.OrdinalIgnoreCase));

      if (folder == null)
        return (false, "Post not found.");

      var metaPath = Path.Combine(folder, "meta.json");
      var bodyPath = Path.Combine(folder, "content.md");
      var assetsDirectory = Path.Combine(folder, "assets");

      if (!File.Exists(metaPath) || !File.Exists(bodyPath))
        return (false, "Post files are missing or corrupted.");

      var metaJson = await File.ReadAllTextAsync(metaPath);
      using var doc = JsonDocument.Parse(metaJson);
      var root = doc.RootElement;

      var authorUsername = root.GetProperty("AuthorUsername").GetString();
      var publishedDate = root.GetProperty("PublishedDate").GetDateTime();

      if (!string.Equals(authorUsername, currentUsername, StringComparison.OrdinalIgnoreCase))
        return (false, "Unauthorized: only the author can modify this post.");

      var existingImages = root.TryGetProperty("Images", out var imagesArray)
          ? imagesArray.EnumerateArray().Select(i => i.GetString() ?? "").Where(i => !string.IsNullOrEmpty(i)).ToList()
          : new List<string>();

      if (updatedData.Images != null && updatedData.Images.Count > 0)
      {
        if (!Directory.Exists(assetsDirectory))
          Directory.CreateDirectory(assetsDirectory);

        foreach (var image in updatedData.Images)
        {
          if (image.Length > 0)
          {
            var fileName = Path.GetFileName(image.FileName);
            fileName = string.Join("_", fileName.Split(Path.GetInvalidFileNameChars()));

            string uniqueFileName = fileName;
            int counter = 1;
            while (File.Exists(Path.Combine(assetsDirectory, uniqueFileName)))
            {
              string fileNameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
              string extension = Path.GetExtension(fileName);
              uniqueFileName = $"{fileNameWithoutExt}_{counter++}{extension}";
            }

            var filePath = Path.Combine(assetsDirectory, uniqueFileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
              await image.CopyToAsync(stream);
            }

            existingImages.Add($"/assets/{uniqueFileName}");
          }
        }
      }

      var title = string.IsNullOrWhiteSpace(updatedData.Title) ? root.GetProperty("Title").GetString() : updatedData.Title;
      var description = string.IsNullOrWhiteSpace(updatedData.Description) ? root.GetProperty("Description").GetString() : updatedData.Description;
      var customUrl = string.IsNullOrWhiteSpace(updatedData.CustomUrl) ? root.GetProperty("CustomUrl").GetString() : updatedData.CustomUrl;

      var tags = (updatedData.Tags == null || updatedData.Tags.Count == 0)
          ? root.GetProperty("Tags").EnumerateArray().Select(t => t.GetString() ?? "").ToList()
          : updatedData.Tags;

      var categories = (updatedData.Categories == null || updatedData.Categories.Count == 0)
          ? root.GetProperty("Categories").EnumerateArray().Select(c => c.GetString() ?? "").ToList()
          : updatedData.Categories;

      var isPublished = updatedData.IsPublished ?? (root.TryGetProperty("IsPublished", out var publishedProp) && publishedProp.GetBoolean());

      DateTime? scheduledDate = updatedData.ScheduledDate;
      if (!scheduledDate.HasValue && root.TryGetProperty("ScheduledDate", out var schedProp) && schedProp.ValueKind != JsonValueKind.Null)
        scheduledDate = schedProp.GetDateTime();

      var updatedMeta = new
      {
        Title = title,
        Description = description,
        CustomUrl = customUrl,
        AuthorUsername = authorUsername,
        Tags = tags,
        Categories = categories,
        PublishedDate = publishedDate,
        ModifiedDate = DateTime.UtcNow,
        Slug = slug,
        IsPublished = isPublished,
        ScheduledDate = scheduledDate,
        Images = existingImages
      };

      var newMeta = JsonSerializer.Serialize(updatedMeta, new JsonSerializerOptions { WriteIndented = true });
      await File.WriteAllTextAsync(metaPath, newMeta);

      if (!string.IsNullOrWhiteSpace(updatedData.Body))
        await File.WriteAllTextAsync(bodyPath, updatedData.Body);

      return (true, "Post updated successfully.");
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error modifying post {slug}: {ex.Message}");
      return (false, "An error occurred while modifying the post.");
    }
  }

  public async Task<(bool Success, string Message)> PublishPostAsync(string slug, string currentUsername)
  {
    try
    {
      var folder = Directory.GetDirectories(_rootPath)
          .FirstOrDefault(dir => dir.EndsWith(slug, StringComparison.OrdinalIgnoreCase));

      if (folder == null)
        return (false, "Post not found.");

      var metaPath = Path.Combine(folder, "meta.json");

      if (!File.Exists(metaPath))
        return (false, "Post metadata is missing.");

      var metaJson = await File.ReadAllTextAsync(metaPath);
      using var doc = JsonDocument.Parse(metaJson);
      var root = doc.RootElement;

      var authorUsername = root.GetProperty("AuthorUsername").GetString();
      if (!string.Equals(authorUsername, currentUsername, StringComparison.OrdinalIgnoreCase))
        return (false, "Unauthorized: only the author can publish this post.");

      if (root.TryGetProperty("ScheduledDate", out var schedProp) && schedProp.ValueKind != JsonValueKind.Null)
      {
        var scheduledDate = schedProp.GetDateTime();
        if (scheduledDate.ToUniversalTime() > DateTime.UtcNow)
        {
          return (false, "Cannot publish a scheduled post before its scheduled time.");
        }
      }

      var publishedDate = root.GetProperty("PublishedDate").GetDateTime();

      var existingImages = root.TryGetProperty("Images", out var imagesProp)
          ? imagesProp.EnumerateArray().Select(i => i.GetString() ?? "").Where(i => !string.IsNullOrEmpty(i)).ToList()
          : new List<string>();

      var updatedMeta = new
      {
        Title = root.GetProperty("Title").GetString(),
        Description = root.GetProperty("Description").GetString(),
        CustomUrl = root.GetProperty("CustomUrl").GetString(),
        AuthorUsername = authorUsername,
        Tags = root.GetProperty("Tags").EnumerateArray().Select(t => t.GetString() ?? "").ToList(),
        Categories = root.GetProperty("Categories").EnumerateArray().Select(c => c.GetString() ?? "").ToList(),
        PublishedDate = publishedDate,
        ModifiedDate = DateTime.UtcNow,
        Slug = slug,
        IsPublished = true,
        ScheduledDate = null as DateTime?,
        Images = existingImages
      };

      var newMeta = JsonSerializer.Serialize(updatedMeta, new JsonSerializerOptions { WriteIndented = true });
      await File.WriteAllTextAsync(metaPath, newMeta);

      return (true, "Post published successfully.");
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error publishing post {slug}: {ex.Message}");
      return (false, "An error occurred while publishing the post.");
    }
  }

  public async Task<bool> DeletePostAsync(string slug)
  {
    try
    {
      var folder = Directory.GetDirectories(_rootPath)
          .FirstOrDefault(dir => dir.EndsWith(slug, StringComparison.OrdinalIgnoreCase));

      if (folder == null)
        return false;

      await Task.Run(() => Directory.Delete(folder, true));
      return true;
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error deleting post {slug}: {ex.Message}");
      return false;
    }
  }

  public IEnumerable<Post> GetAllPostsIncludingDrafts()
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      Post? post = null;
      try
      {
        post = LoadPost(dir);
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error loading post from {dir}: {ex.Message}");
      }

      if (post != null)
        yield return post;
    }
  }
  private bool SlugExists(string slug)
  {
    foreach (var dir in Directory.GetDirectories(_rootPath))
    {
      try
      {
        var post = LoadPost(dir);
        if (post != null && post.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase))
          return true;
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error checking slug in {dir}: {ex.Message}");
      }
    }
    return false;
  }

  public IResult LikePost(string slug, string username)
  {
    var postDir = GetPostDirectoryBySlug(slug);
    if (postDir == null)
      return Results.NotFound(new { message = "Post not found" });

    var post = LoadPost(postDir);
    if (post == null)
      return Results.NotFound(new { message = "Post not found" });

    if (post.Likes.Contains(username, StringComparer.OrdinalIgnoreCase))
      return Results.BadRequest(new { message = "Post already liked" });

    post.Likes.Add(username);
    SavePost(postDir, post);

    return Results.Ok(new { message = "Post liked successfully", likeCount = post.Likes.Count });
  }

  public IResult UnlikePost(string slug, string username)
  {
    var postDir = GetPostDirectoryBySlug(slug);
    if (postDir == null)
      return Results.NotFound(new { message = "Post not found" });

    var post = LoadPost(postDir);
    if (post == null)
      return Results.NotFound(new { message = "Post not found" });

    if (!post.Likes.Contains(username, StringComparer.OrdinalIgnoreCase))
      return Results.BadRequest(new { message = "Post not liked yet" });

    post.Likes.RemoveAll(u => u.Equals(username, StringComparison.OrdinalIgnoreCase));
    SavePost(postDir, post);

    return Results.Ok(new { message = "Post unliked successfully", likeCount = post.Likes.Count });
  }

  public IResult GetPostLikes(string slug)
  {
    var postDir = GetPostDirectoryBySlug(slug);
    if (postDir == null)
      return Results.NotFound(new { message = "Post not found" });

    var post = LoadPost(postDir);
    if (post == null)
      return Results.NotFound(new { message = "Post not found" });

    var likesWithProfiles = post.Likes.Select(username => new
    {
      username = username,
      profilePictureUrl = $"/placeholders/profile.png" // You can enhance this later
    });

    return Results.Ok(likesWithProfiles);
  }

  public IEnumerable<Post> GetAllPosts(string? currentUsername = null)
  {
    if (!Directory.Exists(_rootPath)) yield break;

    foreach (var dir in Directory.GetDirectories(_rootPath, "*", SearchOption.AllDirectories))
    {
      Post? post = null;
      try
      {
        post = LoadPost(dir);
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error loading post from {dir}: {ex.Message}");
      }

      if (post != null && post.IsPublished)
      {
        if (!string.IsNullOrEmpty(currentUsername))
        {
          post.LikedByCurrentUser = post.Likes.Contains(currentUsername, StringComparer.OrdinalIgnoreCase);
        }
        yield return post;
      }
    }
  }

  private string? GetPostDirectoryBySlug(string slug)
  {
    foreach (var dir in Directory.GetDirectories(_rootPath))
    {
      try
      {
        var post = LoadPost(dir);
        if (post != null && post.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase))
          return dir;
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Error checking slug in {dir}: {ex.Message}");
      }
    }
    return null;
  }

  private void SavePost(string postDir, Post post)
  {
    try
    {
      var metaFilePath = Path.Combine(postDir, "meta.json");
      var metaData = new
      {
        title = post.Title,
        description = post.Description,
        author = post.Author,
        publishedDate = post.PublishedDate,
        lastModified = post.LastModified,
        tags = post.Tags,
        categories = post.Categories,
        slug = post.Slug,
        isPublished = post.IsPublished,
        scheduledDate = post.ScheduledDate,
        images = post.Images,
        likes = post.Likes,
        commentCount = post.CommentCount
      };

      var jsonString = JsonSerializer.Serialize(metaData, new JsonSerializerOptions { WriteIndented = true });
      File.WriteAllText(metaFilePath, jsonString);
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error saving post: {ex.Message}");
    }
  }

}