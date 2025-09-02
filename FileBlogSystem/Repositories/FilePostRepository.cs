using System.Text.Json;
using System.Collections.Concurrent;
using FileBlogSystem.Models;
using FileBlogSystem.Repositories.Interfaces;

namespace FileBlogSystem.Repositories
{
  public class FilePostRepository : IPostRepository
  {
    private readonly string _postsPath;
    private readonly string _usersPath;
    private readonly ILogger<FilePostRepository> _logger;
    // Per-post locks to serialize writes and avoid lost updates under concurrency
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _postLocks = new(StringComparer.OrdinalIgnoreCase);
    private static SemaphoreSlim GetLock(string slug) => _postLocks.GetOrAdd(slug, _ => new SemaphoreSlim(1, 1));

    public FilePostRepository(IConfiguration configuration, IWebHostEnvironment env, ILogger<FilePostRepository> logger)
    {
      string contentRoot = configuration["ContentDirectory"] ?? "Content";
      _postsPath = Path.Combine(env.ContentRootPath, contentRoot, "posts");
      _usersPath = Path.Combine(env.ContentRootPath, contentRoot, "users");
      _logger = logger;

      EnsureDirectoryExists(_postsPath);
    }

    public async Task<IEnumerable<Post>> GetAllPostsAsync()
    {
      var posts = new List<Post>();

      if (!Directory.Exists(_postsPath))
        return posts;

      foreach (var directory in Directory.GetDirectories(_postsPath))
      {
        try
        {
          var post = await LoadPostAsync(directory);
          if (post != null && await IsUserActiveAsync(post.Author))
          {
            posts.Add(post);
          }
        }
        catch (Exception ex)
        {
          _logger.LogError(ex, "Error loading post from directory: {Directory}", directory);
        }
      }

      return posts.OrderByDescending(p => p.PublishedDate);
    }

    public async Task<IEnumerable<Post>> GetPublishedPostsAsync()
    {
      var allPosts = await GetAllPostsAsync();
      return allPosts.Where(p => p.IsPublished);
    }

    public async Task<Post?> GetPostBySlugAsync(string slug)
    {
      if (!Directory.Exists(_postsPath))
        return null;

      foreach (var directory in Directory.GetDirectories(_postsPath))
      {
        try
        {
          var post = await LoadPostAsync(directory);
          if (post != null && post.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase))
          {
            if (await IsUserActiveAsync(post.Author))
            {
              return post;
            }
          }
        }
        catch (Exception ex)
        {
          _logger.LogError(ex, "Error loading post from directory: {Directory}", directory);
        }
      }

      return null;
    }

    public async Task<Post?> GetPostByIdAsync(string postId)
    {
      if (!Directory.Exists(_postsPath))
        return null;

      foreach (var directory in Directory.GetDirectories(_postsPath))
      {
        try
        {
          var post = await LoadPostAsync(directory);
          if (post != null && post.Id == postId)
          {
            if (await IsUserActiveAsync(post.Author))
            {
              return post;
            }
          }
        }
        catch (Exception ex)
        {
          _logger.LogError(ex, "Error loading post from directory: {Directory}", directory);
        }
      }

      return null;
    }

    public async Task<IEnumerable<Post>> GetPostsByUserAsync(string username)
    {
      var allPosts = await GetAllPostsAsync();
      return allPosts.Where(p => p.Author.Equals(username, StringComparison.OrdinalIgnoreCase) && p.IsPublished);
    }

    public async Task<IEnumerable<Post>> GetPostsByCategoryAsync(string category)
    {
      var publishedPosts = await GetPublishedPostsAsync();
      return publishedPosts.Where(p => p.Categories.Contains(category, StringComparer.OrdinalIgnoreCase));
    }

    public async Task<IEnumerable<Post>> GetPostsByTagAsync(string tag)
    {
      var publishedPosts = await GetPublishedPostsAsync();
      return publishedPosts.Where(p => p.Tags.Contains(tag, StringComparer.OrdinalIgnoreCase));
    }

    public async Task<IEnumerable<Post>> GetDraftPostsByUserAsync(string username)
    {
      var allPosts = await GetAllPostsAsync();
      return allPosts.Where(p => p.Author.Equals(username, StringComparison.OrdinalIgnoreCase) && !p.IsPublished);
    }

    public async Task<string> CreatePostAsync(Post post)
    {
      try
      {
        string directoryName = $"{post.PublishedDate:yyyy-MM-dd}-{post.Slug}";
        string postDirectory = Path.Combine(_postsPath, directoryName);

        EnsureDirectoryExists(postDirectory);

        // Save metadata
        var metadata = new
        {
          post.Title,
          Description = post.Description,
          CustomUrl = post.Slug,
          AuthorUsername = post.Author,
          post.Tags,
          Categories = post.Categories,
          PublishedDate = post.PublishedDate,
          ModifiedDate = post.LastModified,
          post.Slug,
          post.IsPublished,
          ScheduledDate = post.ScheduledDate,
          Images = post.Images, // Use the actual images from the post
          Likes = post.Likes
        };

        string metadataPath = Path.Combine(postDirectory, "meta.json");
        string metadataJson = JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(metadataPath, metadataJson);

        // Save content
        string contentPath = Path.Combine(postDirectory, "content.md");
        await File.WriteAllTextAsync(contentPath, post.Body);

        // Return slug as identifier
        return post.Slug;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error creating post: {PostId}", post.Id);
        throw;
      }
    }

    public async Task<bool> UpdatePostAsync(Post post)
    {
      try
      {
        var gate = GetLock(post.Slug);
        await gate.WaitAsync();
        try
        {
          return await UpdatePostUnlockedAsync(post);
        }
        finally
        {
          gate.Release();
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error updating post: {PostSlug}", post.Slug);
        return false;
      }
    }

    // Internal update that assumes caller holds the per-post lock
    private async Task<bool> UpdatePostUnlockedAsync(Post post)
    {
      var existingPost = await GetPostBySlugAsync(post.Slug);
      if (existingPost == null)
        return false;

      // Find the existing directory
      string? postDirectory = null;
      foreach (var directory in Directory.GetDirectories(_postsPath))
      {
        var tempPost = await LoadPostAsync(directory);
        if (tempPost != null && tempPost.Slug.Equals(post.Slug, StringComparison.OrdinalIgnoreCase))
        {
          postDirectory = directory;
          break;
        }
      }

      if (postDirectory == null)
        return false;

      // Update metadata (preserve existing images if any exist on disk)
      var existingMetaPath = Path.Combine(postDirectory, "meta.json");
      List<string> existingImages = new();
      if (File.Exists(existingMetaPath))
      {
        try
        {
          var metaJson = await File.ReadAllTextAsync(existingMetaPath);
          var metaDoc = JsonSerializer.Deserialize<JsonElement>(metaJson);
          if (metaDoc.ValueKind == JsonValueKind.Object)
          {
            if (metaDoc.TryGetProperty("Images", out var imgs) || metaDoc.TryGetProperty("images", out imgs))
            {
              if (imgs.ValueKind == JsonValueKind.Array)
              {
                existingImages = imgs.EnumerateArray().Select(i => i.GetString() ?? string.Empty).Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
              }
            }
          }
        }
        catch { /* ignore */ }
      }

      var imagesToWrite = (post.Images != null && post.Images.Any()) ? post.Images : existingImages;
      // Normalize to secure endpoint form by mapping filename
      if (imagesToWrite != null && imagesToWrite.Any())
      {
        imagesToWrite = imagesToWrite
          .Where(s => !string.IsNullOrWhiteSpace(s))
          .Select(s => s.StartsWith("/api/posts/", StringComparison.OrdinalIgnoreCase)
            ? s
            : $"/api/posts/{post.Slug}/assets/{Path.GetFileName(s)}")
          .Distinct(StringComparer.OrdinalIgnoreCase)
          .ToList();
      }

      var metadata = new
      {
        post.Title,
        Description = post.Description,
        CustomUrl = post.Slug,
        AuthorUsername = post.Author,
        post.Tags,
        Categories = post.Categories,
        PublishedDate = post.PublishedDate,
        ModifiedDate = post.LastModified,
        post.Slug,
        post.IsPublished,
        ScheduledDate = post.ScheduledDate,
        Images = imagesToWrite,
        Likes = post.Likes
      };

      string metadataPath = Path.Combine(postDirectory, "meta.json");
      string metadataJson = JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true });
      await File.WriteAllTextAsync(metadataPath, metadataJson);

      // Update content
      string contentPath = Path.Combine(postDirectory, "content.md");
      await File.WriteAllTextAsync(contentPath, post.Body);

      return true;
    }

    public async Task<bool> DeletePostAsync(string slug)
    {
      try
      {
        var post = await GetPostBySlugAsync(slug);
        if (post == null)
          return false;

        // Find and delete the directory
        foreach (var directory in Directory.GetDirectories(_postsPath))
        {
          var tempPost = await LoadPostAsync(directory);
          if (tempPost != null && tempPost.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase))
          {
            Directory.Delete(directory, true);
            return true;
          }
        }

        return false;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error deleting post: {PostSlug}", slug);
        return false;
      }
    }

    public async Task<bool> PublishPostAsync(string slug)
    {
      try
      {
        var post = await GetPostBySlugAsync(slug);
        if (post == null)
          return false;

        post.IsPublished = true;
        post.LastModified = DateTime.UtcNow;

        return await UpdatePostAsync(post);
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error publishing post: {PostSlug}", slug);
        return false;
      }
    }

    public async Task<bool> LikePostAsync(string slug, string username)
    {
      try
      {
        var gate = GetLock(slug);
        await gate.WaitAsync();
        try
        {
          var post = await GetPostBySlugAsync(slug);
          if (post == null)
            return false;

          if (!post.Likes.Contains(username, StringComparer.OrdinalIgnoreCase))
          {
            post.Likes.Add(username);
            return await UpdatePostUnlockedAsync(post);
          }

          return true; // Already liked
        }
        finally
        {
          gate.Release();
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error liking post: {PostSlug}", slug);
        return false;
      }
    }

    public async Task<bool> UnlikePostAsync(string slug, string username)
    {
      try
      {
        var gate = GetLock(slug);
        await gate.WaitAsync();
        try
        {
          var post = await GetPostBySlugAsync(slug);
          if (post == null)
            return false;

          var itemToRemove = post.Likes.FirstOrDefault(like =>
              like.Equals(username, StringComparison.OrdinalIgnoreCase));

          if (itemToRemove != null)
          {
            post.Likes.Remove(itemToRemove);
            return await UpdatePostUnlockedAsync(post);
          }

          return true; // Already not liked
        }
        finally
        {
          gate.Release();
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error unliking post: {PostSlug}", slug);
        return false;
      }
    }

    public async Task<IEnumerable<string>> GetPostLikesAsync(string slug)
    {
      var post = await GetPostBySlugAsync(slug);
      return post?.Likes ?? new List<string>();
    }

    public async Task<bool> PostExistsAsync(string slug)
    {
      var post = await GetPostBySlugAsync(slug);
      return post != null;
    }

    public async Task<string> GenerateUniqueSlugAsync(string baseSlug)
    {
      string slug = baseSlug;
      int counter = 1;

      while (await PostExistsAsync(slug))
      {
        slug = $"{baseSlug}-{counter}";
        counter++;
      }

      return slug;
    }

    // Private helper methods
    private async Task<Post?> LoadPostAsync(string directory)
    {
      try
      {
        string metadataPath = Path.Combine(directory, "meta.json");
        string contentPath = Path.Combine(directory, "content.md");

        if (!File.Exists(metadataPath) || !File.Exists(contentPath))
          return null;

        string metadataJson = await File.ReadAllTextAsync(metadataPath);
        string content = await File.ReadAllTextAsync(contentPath);

        var metadata = JsonSerializer.Deserialize<JsonElement>(metadataJson);

        // Handle both PascalCase and camelCase property names for compatibility
        string title = GetJsonProperty(metadata, "Title", "title") ?? string.Empty;
        string description = GetJsonProperty(metadata, "Description", "description") ?? string.Empty;
        string author = GetJsonProperty(metadata, "AuthorUsername", "author") ?? string.Empty;
        DateTime publishedDate = GetJsonDateProperty(metadata, "PublishedDate", "publishedDate") ?? DateTime.UtcNow;
        DateTime? lastModified = GetJsonDateProperty(metadata, "ModifiedDate", "lastModified");
        var tags = GetJsonArrayProperty(metadata, "Tags", "tags");
        var categories = GetJsonArrayProperty(metadata, "Categories", "categories");
        string slug = GetJsonProperty(metadata, "Slug", "slug") ?? string.Empty;
        bool isPublished = GetJsonBoolProperty(metadata, "IsPublished", "isPublished") ?? false;
        DateTime? scheduledDate = GetJsonDateProperty(metadata, "ScheduledDate", "scheduledDate");

        // Images: try to read and normalize to API URLs if they are stored as relative paths
        var images = GetJsonArrayProperty(metadata, "Images", "images");
        if (images.Any())
        {
          // If images are stored as "/assets/filename.jpg" or similar, convert them to the secure endpoint
          images = images.Select(img =>
          {
            if (string.IsNullOrWhiteSpace(img)) return img;
            if (img.StartsWith("/api/posts/", StringComparison.OrdinalIgnoreCase)) return img;
            // Try to build from known slug
            var fileName = Path.GetFileName(img);
            return $"/api/posts/{slug}/assets/{fileName}";
          }).ToList();
        }

        // Likes: read from metadata if present
        var likesFromMeta = GetJsonArrayProperty(metadata, "Likes", "likes");

        var post = new Post(title, description, content, author, publishedDate, lastModified, tags, categories, slug, isPublished, scheduledDate)
        {
          Id = slug, // Use slug as ID since there's no separate ID field
          Likes = likesFromMeta ?? new List<string>(),
          Images = images
        };

        return post;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error loading post from directory: {Directory}", directory);
        return null;
      }
    }

    private async Task<bool> IsUserActiveAsync(string username)
    {
      try
      {
        string userDirectory = Path.Combine(_usersPath, SanitizeDirectoryName(username));
        string profilePath = Path.Combine(userDirectory, "profile.json");

        if (!File.Exists(profilePath))
          return false;

        string profileJson = await File.ReadAllTextAsync(profilePath);
        var profile = JsonSerializer.Deserialize<JsonElement>(profileJson);

        return !profile.TryGetProperty("IsDeactivated", out var deactivatedProp) || !deactivatedProp.GetBoolean();
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error checking user active status: {Username}", username);
        return false;
      }
    }

    private void EnsureDirectoryExists(string path)
    {
      if (!Directory.Exists(path))
      {
        Directory.CreateDirectory(path);
      }
    }

    private string SanitizeDirectoryName(string input)
    {
      if (string.IsNullOrWhiteSpace(input))
        return "unknown";

      var invalidChars = Path.GetInvalidFileNameChars();
      return new string(input.Where(c => !invalidChars.Contains(c)).ToArray());
    }

    // Helper methods for handling both PascalCase and camelCase property names
    private static string? GetJsonProperty(JsonElement element, string pascalCase, string camelCase)
    {
      if (element.TryGetProperty(pascalCase, out var pascalProp))
        return pascalProp.GetString();
      if (element.TryGetProperty(camelCase, out var camelProp))
        return camelProp.GetString();
      return null;
    }

    private static DateTime? GetJsonDateProperty(JsonElement element, string pascalCase, string camelCase)
    {
      if (element.TryGetProperty(pascalCase, out var pascalProp) && pascalProp.ValueKind != JsonValueKind.Null)
        return pascalProp.GetDateTime();
      if (element.TryGetProperty(camelCase, out var camelProp) && camelProp.ValueKind != JsonValueKind.Null)
        return camelProp.GetDateTime();
      return null;
    }

    private static bool? GetJsonBoolProperty(JsonElement element, string pascalCase, string camelCase)
    {
      if (element.TryGetProperty(pascalCase, out var pascalProp))
        return pascalProp.GetBoolean();
      if (element.TryGetProperty(camelCase, out var camelProp))
        return camelProp.GetBoolean();
      return null;
    }

    private static List<string> GetJsonArrayProperty(JsonElement element, string pascalCase, string camelCase)
    {
      if (element.TryGetProperty(pascalCase, out var pascalProp))
        return pascalProp.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToList();
      if (element.TryGetProperty(camelCase, out var camelProp))
        return camelProp.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToList();
      return new List<string>();
    }
  }
}
