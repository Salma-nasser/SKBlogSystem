using System.Text.Json;
using FileBlogSystem.Models;
using FileBlogSystem.Repositories.Interfaces;

namespace FileBlogSystem.Repositories
{
  public class FileCommentRepository : ICommentRepository
  {
    private readonly string _postsPath;
    private readonly ILogger<FileCommentRepository> _logger;

    public FileCommentRepository(IConfiguration configuration, IWebHostEnvironment env, ILogger<FileCommentRepository> logger)
    {
      string contentRoot = configuration["ContentDirectory"] ?? "Content";
      _postsPath = Path.Combine(env.ContentRootPath, contentRoot, "posts");
      _logger = logger;
    }

    public async Task<IEnumerable<Comment>> GetCommentsByPostSlugAsync(string postSlug)
    {
      var comments = new List<Comment>();

      try
      {
        var postDirectory = await FindPostDirectoryBySlugAsync(postSlug);
        if (postDirectory == null)
          return comments;

        string commentsPath = Path.Combine(postDirectory, "comments.json");
        if (!File.Exists(commentsPath))
          return comments;

        string commentsJson = await File.ReadAllTextAsync(commentsPath);
        var commentElements = JsonSerializer.Deserialize<JsonElement[]>(commentsJson);

        foreach (var element in commentElements ?? Array.Empty<JsonElement>())
        {
          var comment = new Comment
          {
            Id = element.GetProperty("Id").GetString() ?? string.Empty,
            Author = element.GetProperty("Author").GetString() ?? string.Empty,
            Content = element.GetProperty("Content").GetString() ?? string.Empty,
            CreatedAt = element.GetProperty("CreatedAt").GetDateTime()
          };

          comments.Add(comment);
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting comments for post: {PostSlug}", postSlug);
      }

      return comments.OrderBy(c => c.CreatedAt);
    }

    public async Task<Comment?> GetCommentByIdAsync(string commentId)
    {
      try
      {
        if (!Directory.Exists(_postsPath))
          return null;

        foreach (var postDirectory in Directory.GetDirectories(_postsPath))
        {
          string commentsPath = Path.Combine(postDirectory, "comments.json");
          if (!File.Exists(commentsPath))
            continue;

          string commentsJson = await File.ReadAllTextAsync(commentsPath);
          var commentElements = JsonSerializer.Deserialize<JsonElement[]>(commentsJson);

          foreach (var element in commentElements ?? Array.Empty<JsonElement>())
          {
            if (element.GetProperty("Id").GetString() == commentId)
            {
              return new Comment
              {
                Id = element.GetProperty("Id").GetString() ?? string.Empty,
                Author = element.GetProperty("Author").GetString() ?? string.Empty,
                Content = element.GetProperty("Content").GetString() ?? string.Empty,
                CreatedAt = element.GetProperty("CreatedAt").GetDateTime()
              };
            }
          }
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting comment by ID: {CommentId}", commentId);
      }

      return null;
    }

    public async Task<IEnumerable<Comment>> GetCommentsByUserAsync(string username)
    {
      var comments = new List<Comment>();

      try
      {
        if (!Directory.Exists(_postsPath))
          return comments;

        foreach (var postDirectory in Directory.GetDirectories(_postsPath))
        {
          string commentsPath = Path.Combine(postDirectory, "comments.json");
          if (!File.Exists(commentsPath))
            continue;

          string commentsJson = await File.ReadAllTextAsync(commentsPath);
          var commentElements = JsonSerializer.Deserialize<JsonElement[]>(commentsJson);

          foreach (var element in commentElements ?? Array.Empty<JsonElement>())
          {
            if (element.GetProperty("Author").GetString()?.Equals(username, StringComparison.OrdinalIgnoreCase) == true)
            {
              var comment = new Comment
              {
                Id = element.GetProperty("Id").GetString() ?? string.Empty,
                Author = element.GetProperty("Author").GetString() ?? string.Empty,
                Content = element.GetProperty("Content").GetString() ?? string.Empty,
                CreatedAt = element.GetProperty("CreatedAt").GetDateTime()
              };

              comments.Add(comment);
            }
          }
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting comments for user: {Username}", username);
      }

      return comments.OrderByDescending(c => c.CreatedAt);
    }

    public async Task<IEnumerable<Comment>> GetAllCommentsAsync()
    {
      var comments = new List<Comment>();

      try
      {
        if (!Directory.Exists(_postsPath))
          return comments;

        foreach (var postDirectory in Directory.GetDirectories(_postsPath))
        {
          string commentsPath = Path.Combine(postDirectory, "comments.json");
          if (!File.Exists(commentsPath))
            continue;

          string commentsJson = await File.ReadAllTextAsync(commentsPath);
          var commentElements = JsonSerializer.Deserialize<JsonElement[]>(commentsJson);

          foreach (var element in commentElements ?? Array.Empty<JsonElement>())
          {
            var comment = new Comment
            {
              Id = element.GetProperty("Id").GetString() ?? string.Empty,
              Author = element.GetProperty("Author").GetString() ?? string.Empty,
              Content = element.GetProperty("Content").GetString() ?? string.Empty,
              CreatedAt = element.GetProperty("CreatedAt").GetDateTime()
            };

            comments.Add(comment);
          }
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error getting all comments");
      }

      return comments.OrderByDescending(c => c.CreatedAt);
    }

    public async Task<string> CreateCommentAsync(string postSlug, Comment comment)
    {
      try
      {
        var postDirectory = await FindPostDirectoryBySlugAsync(postSlug);
        if (postDirectory == null)
          throw new InvalidOperationException($"Post with slug '{postSlug}' not found");

        string commentsPath = Path.Combine(postDirectory, "comments.json");
        var comments = new List<Comment>();

        // Load existing comments
        if (File.Exists(commentsPath))
        {
          string existingCommentsJson = await File.ReadAllTextAsync(commentsPath);
          var existingCommentElements = JsonSerializer.Deserialize<JsonElement[]>(existingCommentsJson);

          foreach (var element in existingCommentElements ?? Array.Empty<JsonElement>())
          {
            comments.Add(new Comment
            {
              Id = element.GetProperty("Id").GetString() ?? string.Empty,
              Author = element.GetProperty("Author").GetString() ?? string.Empty,
              Content = element.GetProperty("Content").GetString() ?? string.Empty,
              CreatedAt = element.GetProperty("CreatedAt").GetDateTime()
            });
          }
        }

        // Add new comment
        comment.Id = Guid.NewGuid().ToString();
        comments.Add(comment);

        // Save comments
        var commentData = comments.Select(c => new
        {
          c.Id,
          c.Author,
          c.Content,
          c.CreatedAt
        }).ToArray();

        string commentsJson = JsonSerializer.Serialize(commentData, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(commentsPath, commentsJson);

        return comment.Id;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error creating comment for post: {PostSlug}", postSlug);
        throw;
      }
    }

    public async Task<bool> UpdateCommentAsync(string postSlug, Comment comment)
    {
      try
      {
        var postDirectory = await FindPostDirectoryBySlugAsync(postSlug);
        if (postDirectory == null)
          return false;

        string commentsPath = Path.Combine(postDirectory, "comments.json");
        if (!File.Exists(commentsPath))
          return false;

        string commentsJson = await File.ReadAllTextAsync(commentsPath);
        var commentElements = JsonSerializer.Deserialize<JsonElement[]>(commentsJson);
        var comments = new List<Comment>();

        bool commentUpdated = false;

        foreach (var element in commentElements ?? Array.Empty<JsonElement>())
        {
          var existingComment = new Comment
          {
            Id = element.GetProperty("Id").GetString() ?? string.Empty,
            Author = element.GetProperty("Author").GetString() ?? string.Empty,
            Content = element.GetProperty("Content").GetString() ?? string.Empty,
            CreatedAt = element.GetProperty("CreatedAt").GetDateTime()
          };

          if (existingComment.Id == comment.Id)
          {
            comments.Add(comment);
            commentUpdated = true;
          }
          else
          {
            comments.Add(existingComment);
          }
        }

        if (!commentUpdated)
          return false;

        // Save updated comments
        var commentData = comments.Select(c => new
        {
          c.Id,
          c.Author,
          c.Content,
          c.CreatedAt
        }).ToArray();

        string updatedCommentsJson = JsonSerializer.Serialize(commentData, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(commentsPath, updatedCommentsJson);

        return true;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error updating comment: {CommentId}", comment.Id);
        return false;
      }
    }

    public async Task<bool> DeleteCommentAsync(string commentId)
    {
      try
      {
        if (!Directory.Exists(_postsPath))
          return false;

        foreach (var postDirectory in Directory.GetDirectories(_postsPath))
        {
          string commentsPath = Path.Combine(postDirectory, "comments.json");
          if (!File.Exists(commentsPath))
            continue;

          string commentsJson = await File.ReadAllTextAsync(commentsPath);
          var commentElements = JsonSerializer.Deserialize<JsonElement[]>(commentsJson);
          var comments = new List<Comment>();
          bool commentDeleted = false;

          foreach (var element in commentElements ?? Array.Empty<JsonElement>())
          {
            if (element.GetProperty("Id").GetString() != commentId)
            {
              comments.Add(new Comment
              {
                Id = element.GetProperty("Id").GetString() ?? string.Empty,
                Author = element.GetProperty("Author").GetString() ?? string.Empty,
                Content = element.GetProperty("Content").GetString() ?? string.Empty,
                CreatedAt = element.GetProperty("CreatedAt").GetDateTime()
              });
            }
            else
            {
              commentDeleted = true;
            }
          }

          if (commentDeleted)
          {
            var commentData = comments.Select(c => new
            {
              c.Id,
              c.Author,
              c.Content,
              c.CreatedAt
            }).ToArray();

            string updatedCommentsJson = JsonSerializer.Serialize(commentData, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(commentsPath, updatedCommentsJson);

            return true;
          }
        }

        return false;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error deleting comment: {CommentId}", commentId);
        return false;
      }
    }

    public async Task<bool> CommentExistsAsync(string commentId)
    {
      var comment = await GetCommentByIdAsync(commentId);
      return comment != null;
    }

    public async Task<int> GetCommentsCountByPostSlugAsync(string postSlug)
    {
      var comments = await GetCommentsByPostSlugAsync(postSlug);
      return comments.Count();
    }

    // Private helper methods
    private async Task<string?> FindPostDirectoryBySlugAsync(string slug)
    {
      try
      {
        if (!Directory.Exists(_postsPath))
          return null;

        foreach (var directory in Directory.GetDirectories(_postsPath))
        {
          string metadataPath = Path.Combine(directory, "metadata.json");
          if (!File.Exists(metadataPath))
            continue;

          string metadataJson = await File.ReadAllTextAsync(metadataPath);
          var metadata = JsonSerializer.Deserialize<JsonElement>(metadataJson);

          if (metadata.TryGetProperty("Slug", out var slugProp) &&
              slugProp.GetString()?.Equals(slug, StringComparison.OrdinalIgnoreCase) == true)
          {
            return directory;
          }
        }

        return null;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error finding post directory by slug: {Slug}", slug);
        return null;
      }
    }
  }
}
