using System.Text.Json;
using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;

namespace FileBlogSystem.Services;

public class BlogPostService : IBlogPostService
{
  private readonly string _rootPath;
  private readonly string _usersDirectory; // Added field for users directory

  public BlogPostService(IConfiguration configuration, IWebHostEnvironment env)
  {
    string? contentRoot = configuration["ContentDirectory"] ?? "Content";
    _rootPath = Path.Combine(env.ContentRootPath, contentRoot, "posts");
    _usersDirectory = Path.Combine(env.ContentRootPath, contentRoot, "users"); // Initialize users directory

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

  public Post? GetPostBySlug(string slug, string? currentUsername)
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

  public IEnumerable<Post> GetPostsByUser(string username, string? currentUsername = null)
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
        author = GetSafeString("authorUsername");
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

      // Read the body content from content.md
      var body = File.ReadAllText(bodyPath);
      var post = new Post(title, description, body ?? string.Empty, author, publishedDate, lastModified, tags, categories, slug, isPublished, scheduledDate);

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
      var date = DateTime.UtcNow;
      var baseSlug = string.IsNullOrWhiteSpace(request.CustomUrl) ? GenerateSlugFromTitle(request.Title) : request.CustomUrl;

      // Generate a unique slug to avoid collisions
      var slug = GenerateUniqueSlug(baseSlug);

      var folder = Path.Combine(_rootPath, $"{date:yyyy-MM-dd}-{slug}");

      Directory.CreateDirectory(folder);
      var assetsDirectory = Path.Combine(folder, "assets");
      Directory.CreateDirectory(assetsDirectory);

      var savedImages = new List<string>();

      if (request.Images != null && request.Images.Count > 0)
      {
        foreach (var image in request.Images)
        {
          var savedPath = await ImageService.SaveAndCompressAsync(image, assetsDirectory);
          if (savedPath != null)
            savedImages.Add(savedPath);
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
        request.Tags,
        request.Categories,
        PublishedDate = date,
        ModifiedDate = (DateTime?)null,
        Slug = slug,
        request.IsPublished,
        request.ScheduledDate,
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
        request.Title,
        request.Description,
        request.Body,
        AuthorUsername = authorUsername,
        request.Tags,
        request.Categories,
        PublishedDate = date,
        request.IsPublished,
        request.ScheduledDate,
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

      JsonElement root = default;
      bool rootAssigned = false;

      // Use retry logic for file access to handle temporary locks
      for (int attempt = 0; attempt < 3; attempt++)
      {
        try
        {
          var metaJson = await File.ReadAllTextAsync(metaPath);
          using var doc = JsonDocument.Parse(metaJson);
          root = doc.RootElement.Clone(); // Clone to avoid disposal issues
          rootAssigned = true;
          break;
        }
        catch (IOException ex) when (attempt < 2)
        {
          Console.WriteLine($"File access attempt {attempt + 1} failed: {ex.Message}. Retrying...");
          await Task.Delay(100); // Wait 100ms before retry
        }
        catch (IOException ex) when (attempt == 2)
        {
          throw new IOException($"Failed to access file after 3 attempts: {ex.Message}", ex);
        }
      }

      if (!rootAssigned)
        return (false, "Failed to read post metadata after multiple attempts.");

      // Use the same safe property access pattern as in LoadPost
      string GetSafeString(string propertyName)
      {
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

      List<string> GetSafeStringArray(string propertyName)
      {
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.EnumerateArray().Select(t => t.GetString() ?? "").ToList();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.EnumerateArray().Select(t => t.GetString() ?? "").ToList();
        return new List<string>();
      }

      bool GetSafeBool(string propertyName, bool defaultValue = false)
      {
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.GetBoolean();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.GetBoolean();
        return defaultValue;
      }

      int GetSafeInt(string propertyName, int defaultValue = 0)
      {
        if (root.TryGetProperty(propertyName, out var prop))
          return prop.GetInt32();
        if (root.TryGetProperty(char.ToUpper(propertyName[0]) + propertyName.Substring(1), out var upperProp))
          return upperProp.GetInt32();
        return defaultValue;
      }

      // Now use the safe accessors
      var authorUsername = GetSafeString("author");
      if (string.IsNullOrEmpty(authorUsername))
        authorUsername = GetSafeString("authorUsername");

      var publishedDate = GetSafeDateTime("publishedDate", DateTime.UtcNow);
      var existingLikes = GetSafeStringArray("likes");
      var commentCount = GetSafeInt("commentCount");

      if (!string.Equals(authorUsername, currentUsername, StringComparison.OrdinalIgnoreCase))
        return (false, "Unauthorized: only the author can modify this post.");

      // Get existing images first
      var existingImages = GetSafeStringArray("images");

      // Clear existing images - we'll replace them completely
      var newImages = new List<string>();

      if (updatedData.Images != null && updatedData.Images.Count > 0)
      {
        if (!Directory.Exists(assetsDirectory))
          Directory.CreateDirectory(assetsDirectory);

        // Delete all existing image files
        foreach (var file in Directory.GetFiles(assetsDirectory))
        {
          try { File.Delete(file); }
          catch (Exception ex)
          {
            Console.WriteLine($"Warning: Could not delete image file {file}: {ex.Message}");
          }
        }

        foreach (var image in updatedData.Images)
        {
          var savedPath = await ImageService.SaveAndCompressAsync(image, assetsDirectory);
          if (savedPath != null)
            newImages.Add(savedPath);
        }
      }
      else
      {
        newImages = existingImages;
      }

      // Use updated data or fall back to existing data using safe accessors
      var title = string.IsNullOrWhiteSpace(updatedData.Title) ? GetSafeString("title") : updatedData.Title;
      var description = string.IsNullOrWhiteSpace(updatedData.Description) ? GetSafeString("description") : updatedData.Description;
      var customUrl = string.IsNullOrWhiteSpace(updatedData.CustomUrl) ? GetSafeString("customUrl") : updatedData.CustomUrl;

      var tags = (updatedData.Tags == null || updatedData.Tags.Count == 0)
          ? GetSafeStringArray("tags")
          : updatedData.Tags;

      var categories = (updatedData.Categories == null || updatedData.Categories.Count == 0)
          ? GetSafeStringArray("categories")
          : updatedData.Categories;

      var isPublished = updatedData.IsPublished ?? GetSafeBool("isPublished");

      // Create the updated metadata - use the new images list
      var updatedMeta = new
      {
        title = title,
        description = description,
        customUrl = customUrl,
        author = authorUsername,
        tags = tags,
        categories = categories,
        publishedDate = publishedDate,
        lastModified = DateTime.UtcNow,
        slug = slug,
        isPublished = isPublished,
        scheduledDate = (DateTime?)null,
        images = newImages, // Use the new images list
        likes = existingLikes,
        commentCount = commentCount
      };

      var newMeta = JsonSerializer.Serialize(updatedMeta, new JsonSerializerOptions { WriteIndented = true });

      // Use retry logic for file writing to handle temporary locks
      for (int attempt = 0; attempt < 3; attempt++)
      {
        try
        {
          await File.WriteAllTextAsync(metaPath, newMeta);
          break;
        }
        catch (IOException ex) when (attempt < 2)
        {
          Console.WriteLine($"File write attempt {attempt + 1} failed: {ex.Message}. Retrying...");
          await Task.Delay(100); // Wait 100ms before retry
        }
      }

      if (!string.IsNullOrWhiteSpace(updatedData.Body))
      {
        // Use retry logic for content file writing as well
        for (int attempt = 0; attempt < 3; attempt++)
        {
          try
          {
            await File.WriteAllTextAsync(bodyPath, updatedData.Body);
            break;
          }
          catch (IOException ex) when (attempt < 2)
          {
            Console.WriteLine($"Content file write attempt {attempt + 1} failed: {ex.Message}. Retrying...");
            await Task.Delay(100); // Wait 100ms before retry
          }
        }
      }

      return (true, "Post updated successfully.");
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error modifying post {slug}: {ex.Message}");
      Console.WriteLine($"Stack trace: {ex.StackTrace}");
      return (false, $"An error occurred while modifying the post: {ex.Message}");
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
        Title = root.GetProperty("title").GetString(),
        Description = root.GetProperty("description").GetString(),
        CustomUrl = root.GetProperty("customUrl").GetString(),
        AuthorUsername = authorUsername,
        Tags = root.GetProperty("tags").EnumerateArray().Select(t => t.GetString() ?? "").ToList(),
        Categories = root.GetProperty("categories").EnumerateArray().Select(c => c.GetString() ?? "").ToList(),
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

  private string GenerateUniqueSlug(string baseSlug)
  {
    if (!SlugExists(baseSlug))
      return baseSlug;

    int counter = 1;
    string uniqueSlug;
    do
    {
      uniqueSlug = $"{baseSlug}-{counter}";
      counter++;
    } while (SlugExists(uniqueSlug));

    return uniqueSlug;
  }
  private string GenerateSlugFromTitle(string title)
  {
    if (string.IsNullOrWhiteSpace(title))
      return "untitled";

    var slug = title.ToLowerInvariant();

    // Remove all non-alphanumeric characters except spaces and hyphens
    slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[^a-z0-9\s-]", "");

    // Replace multiple spaces or hyphens with single hyphen
    slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[\s-]+", "-");

    // Trim hyphens from start and end
    slug = slug.Trim('-');

    // Ensure we have something
    if (string.IsNullOrEmpty(slug))
      return "untitled";

    return slug;
  }

  // ...existing code...
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
    try
    {
      var post = GetPostBySlug(slug, "");
      if (post == null)
      {
        return Results.NotFound($"Post with slug '{slug}' not found");
      }

      // Get full user objects instead of just usernames
      var userObjects = new List<object>();

      foreach (var username in post.Likes)
      {
        // Get user profile information
        var userProfilePath = Path.Combine(_usersDirectory, username, "profile.json");

        if (File.Exists(userProfilePath))
        {
          try
          {
            var userProfileJson = File.ReadAllText(userProfilePath);
            var userProfile = JsonSerializer.Deserialize<User>(userProfileJson, new JsonSerializerOptions
            {
              PropertyNameCaseInsensitive = true
            });

            userObjects.Add(new
            {
              username = username,
              displayName = userProfile?.Username ?? username,
              profilePictureUrl = userProfile?.ProfilePictureUrl ?? "",
              bio = userProfile?.Bio ?? ""
            });
          }
          catch (Exception ex)
          {
            Console.WriteLine($"Error reading profile for {username}: {ex.Message}");
            // Fallback to username only if profile reading fails
            userObjects.Add(new
            {
              username = username,
              displayName = username,
              profilePictureUrl = "",
              bio = ""
            });
          }
        }
        else
        {
          // Fallback if no profile exists
          userObjects.Add(new
          {
            username = username,
            displayName = username,
            profilePictureUrl = "",
            bio = ""
          });
        }
      }

      return Results.Ok(userObjects);
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error getting post likes: {ex.Message}");
      return Results.Problem("Failed to get post likes", statusCode: StatusCodes.Status500InternalServerError);
    }
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
      var bodyFilePath = Path.Combine(postDir, "content.md");

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

      // Save the body content to content.md
      if (!string.IsNullOrEmpty(post.Body))
      {
        File.WriteAllText(bodyFilePath, post.Body);
      }
    }
    catch (Exception ex)
    {
      Console.WriteLine($"Error saving post: {ex.Message}");
    }
  }

}