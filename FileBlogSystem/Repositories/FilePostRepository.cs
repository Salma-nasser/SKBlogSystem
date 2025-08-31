using System.Text.Json;
using FileBlogSystem.Models;
using FileBlogSystem.Repositories.Interfaces;

namespace FileBlogSystem.Repositories
{
  public class FilePostRepository : IPostRepository
  {
    private readonly string _postsPath;
    private readonly string _usersPath;
    private readonly ILogger<FilePostRepository> _logger;

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
          post.Id,
          post.Title,
          post.Slug,
          post.Author,
          PublishedDate = post.PublishedDate,
          LastModified = post.LastModified,
          post.IsPublished,
          post.Categories,
          post.Tags,
          Description = post.Description,
          post.Likes,
          ScheduledDate = post.ScheduledDate
        };

        string metadataPath = Path.Combine(postDirectory, "metadata.json");
        string metadataJson = JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(metadataPath, metadataJson);

        // Save content
        string contentPath = Path.Combine(postDirectory, "content.md");
        await File.WriteAllTextAsync(contentPath, post.Body);

        return post.Id;
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

        // Update metadata
        var metadata = new
        {
          post.Id,
          post.Title,
          post.Slug,
          post.Author,
          PublishedDate = post.PublishedDate,
          LastModified = post.LastModified,
          post.IsPublished,
          post.Categories,
          post.Tags,
          Description = post.Description,
          post.Likes,
          ScheduledDate = post.ScheduledDate
        };

        string metadataPath = Path.Combine(postDirectory, "metadata.json");
        string metadataJson = JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(metadataPath, metadataJson);

        // Update content
        string contentPath = Path.Combine(postDirectory, "content.md");
        await File.WriteAllTextAsync(contentPath, post.Body);

        return true;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error updating post: {PostSlug}", post.Slug);
        return false;
      }
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
        var post = await GetPostBySlugAsync(slug);
        if (post == null)
          return false;

        if (!post.Likes.Contains(username, StringComparer.OrdinalIgnoreCase))
        {
          post.Likes.Add(username);
          return await UpdatePostAsync(post);
        }

        return true; // Already liked
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
        var post = await GetPostBySlugAsync(slug);
        if (post == null)
          return false;

        var itemToRemove = post.Likes.FirstOrDefault(like =>
            like.Equals(username, StringComparison.OrdinalIgnoreCase));

        if (itemToRemove != null)
        {
          post.Likes.Remove(itemToRemove);
          return await UpdatePostAsync(post);
        }

        return true; // Already not liked
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
        string metadataPath = Path.Combine(directory, "metadata.json");
        string contentPath = Path.Combine(directory, "content.md");

        if (!File.Exists(metadataPath) || !File.Exists(contentPath))
          return null;

        string metadataJson = await File.ReadAllTextAsync(metadataPath);
        string content = await File.ReadAllTextAsync(contentPath);

        var metadata = JsonSerializer.Deserialize<JsonElement>(metadataJson);

        string title = metadata.GetProperty("Title").GetString() ?? string.Empty;
        string description = metadata.TryGetProperty("Description", out var descProp) ? descProp.GetString() ?? string.Empty : string.Empty;
        string author = metadata.GetProperty("Author").GetString() ?? string.Empty;
        DateTime publishedDate = metadata.TryGetProperty("PublishedDate", out var pubProp) ? pubProp.GetDateTime() : DateTime.UtcNow;
        DateTime? lastModified = metadata.TryGetProperty("LastModified", out var modProp) ? modProp.GetDateTime() : null;
        var tags = metadata.GetProperty("Tags").EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToList();
        var categories = metadata.GetProperty("Categories").EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToList();
        string slug = metadata.GetProperty("Slug").GetString() ?? string.Empty;
        bool isPublished = metadata.GetProperty("IsPublished").GetBoolean();
        DateTime? scheduledDate = metadata.TryGetProperty("ScheduledDate", out var schedProp) && schedProp.ValueKind != JsonValueKind.Null ? schedProp.GetDateTime() : null;

        var post = new Post(title, description, content, author, publishedDate, lastModified, tags, categories, slug, isPublished, scheduledDate)
        {
          Id = metadata.GetProperty("Id").GetString() ?? string.Empty,
          Likes = metadata.TryGetProperty("Likes", out var likesProp) ? likesProp.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToList() : new List<string>()
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
  }
}
