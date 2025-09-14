using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using FileBlogSystem.Repositories.Interfaces;
using System.Text.RegularExpressions;

namespace FileBlogSystem.Services;

public class BlogPostService : IBlogPostService
{
  private readonly IPostRepository _postRepository;
  private readonly IUserRepository _userRepository;
  private readonly ILogger<BlogPostService> _logger;
  private readonly IWebHostEnvironment _env;

  public BlogPostService(
      IPostRepository postRepository,
      IUserRepository userRepository,
      ILogger<BlogPostService> logger,
      IWebHostEnvironment env)
  {
    _postRepository = postRepository;
    _userRepository = userRepository;
    _logger = logger;
    _env = env;
  }

  public IEnumerable<Post> GetAllPosts(string? currentUsername = null)
  {
    try
    {
      var posts = _postRepository.GetAllPostsAsync().Result;
      var visible = posts.Where(p => p.IsPublished || (currentUsername != null && p.Author == currentUsername)).ToList();
      if (!string.IsNullOrEmpty(currentUsername))
      {
        foreach (var p in visible)
        {
          p.LikedByCurrentUser = p.Likes.Any(l => l.Equals(currentUsername, StringComparison.OrdinalIgnoreCase));
        }
      }
      return visible;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting all posts");
      return Enumerable.Empty<Post>();
    }
  }

  public IEnumerable<Post> GetPostsByCategory(string category, string currentUsername)
  {
    try
    {
      var posts = GetAllPosts(currentUsername);
      return posts.Where(p => p.Categories != null && p.Categories.Contains(category, StringComparer.OrdinalIgnoreCase));
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting posts by category: {Category}", category);
      return Enumerable.Empty<Post>();
    }
  }

  public IEnumerable<Post> GetPostsByTag(string tag, string currentUsername)
  {
    try
    {
      var posts = GetAllPosts(currentUsername);
      return posts.Where(p => p.Tags != null && p.Tags.Contains(tag, StringComparer.OrdinalIgnoreCase));
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting posts by tag: {Tag}", tag);
      return Enumerable.Empty<Post>();
    }
  }

  public Post? GetPostBySlug(string slug, string? currentUsername)
  {
    try
    {
      var post = _postRepository.GetPostBySlugAsync(slug).Result;
      if (post == null) return null;

      // Check if user can access this post
      if (!post.IsPublished && (currentUsername == null || post.Author != currentUsername))
      {
        return null;
      }

      if (!string.IsNullOrEmpty(currentUsername))
      {
        post.LikedByCurrentUser = post.Likes.Any(l => l.Equals(currentUsername, StringComparison.OrdinalIgnoreCase));
      }
      return post;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting post by slug: {Slug}", slug);
      return null;
    }
  }

  public IEnumerable<Post> GetUserDrafts(string username)
  {
    try
    {
      var posts = _postRepository.GetPostsByUserAsync(username).Result;
      return posts.Where(p => !p.IsPublished);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting user drafts for: {Username}", username);
      return Enumerable.Empty<Post>();
    }
  }

  public async Task<dynamic> CreatePostAsync(CreatePostRequest request, string authorUsername)
  {
    try
    {
      // Determine base slug and generate a unique final slug first
      var baseSlug = GenerateSlug(string.IsNullOrWhiteSpace(request.CustomUrl) ? request.Title : request.CustomUrl!);
      var finalSlug = await _postRepository.GenerateUniqueSlugAsync(baseSlug);

      // Use current UTC date for folder naming (even for drafts) to avoid 0001-01-01
      var folderDate = DateTime.UtcNow;
      var post = new Post(
          title: request.Title,
          description: request.Description,
          body: request.Body,
          author: authorUsername,
          publishedDate: (request.IsPublished ?? false) ? folderDate : folderDate,
          lastModified: DateTime.UtcNow,
          tags: request.Tags ?? new List<string>(),
          categories: request.Categories ?? new List<string>(),
          slug: finalSlug,
          isPublished: request.IsPublished ?? false,
          scheduledDate: request.ScheduledDate
      );

      // Handle image uploads if any
      if (request.Images != null && request.Images.Any())
      {
        foreach (var image in request.Images)
        {
          if (image.Length > 0)
          {
            // Save under the finalized slug and date-based directory
            var directoryName = $"{folderDate:yyyy-MM-dd}-{finalSlug}";
            var assetsDirectory = Path.Combine(_env.ContentRootPath, "Content", "posts", directoryName, "assets");

            try
            {
              var savedFileName = await ImageService.SaveAndCompressAsync(image, assetsDirectory);
              var imageUrl = $"/api/posts/{finalSlug}/assets/{savedFileName}";
              post.Images.Add(imageUrl);
            }
            catch (Exception ex)
            {
              _logger.LogError(ex, "Error saving image: {FileName}", image.FileName);
            }
          }
        }
      }

      // Persist the post (repository should not change slug)
      string postId = await _postRepository.CreatePostAsync(post);
      if (string.IsNullOrEmpty(postId))
      {
        // Fall back to slug if repository returns empty
        postId = finalSlug;
      }
      post.Slug = finalSlug;

      return new { Success = true, Slug = post.Slug, Message = "Post created successfully" };
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error creating post");
      return new { Success = false, Message = "Failed to create post" };
    }
  }

  public async Task<(bool Success, string Message)> ModifyPostAsync(string slug, CreatePostRequest updatedData, string currentUsername)
  {
    try
    {
      var post = await _postRepository.GetPostBySlugAsync(slug);
      if (post == null)
      {
        return (false, "Post not found");
      }

      if (post.Author != currentUsername)
      {
        return (false, "Unauthorized");
      }

      // Update post properties
      post.Title = updatedData.Title;
      post.Body = updatedData.Body;
      post.Description = updatedData.Description;
      post.Categories = updatedData.Categories ?? new List<string>();
      post.Tags = updatedData.Tags ?? new List<string>();
      post.LastModified = DateTime.UtcNow;

      // Images: merge kept images (normalized) + newly uploaded ones saved to assets
      var finalImages = new List<string>();

      // 1) Normalize kept images coming from the client
      if (updatedData.KeptImages != null && updatedData.KeptImages.Count > 0)
      {
        foreach (var kept in updatedData.KeptImages)
        {
          if (string.IsNullOrWhiteSpace(kept)) continue;
          // If already secure URL keep as is, else map by filename to secure endpoint
          var normalized = kept.StartsWith("/api/posts/", StringComparison.OrdinalIgnoreCase)
            ? kept
            : $"/api/posts/{slug}/assets/{Path.GetFileName(kept)}";
          if (!string.IsNullOrWhiteSpace(normalized) && !finalImages.Contains(normalized, StringComparer.OrdinalIgnoreCase))
          {
            finalImages.Add(normalized);
          }
        }
      }

      // 2) Save any newly uploaded images into this post's assets folder
      if (updatedData.Images != null && updatedData.Images.Any())
      {
        // Find the existing post folder by slug (e.g., yyyy-MM-dd-slug)
        var postsRoot = Path.Combine(_env.ContentRootPath, "Content", "posts");
        string? postFolder = Directory.GetDirectories(postsRoot)
          .FirstOrDefault(d => Path.GetFileName(d).EndsWith("-" + slug, StringComparison.OrdinalIgnoreCase));

        // If not found, fallback to published date pattern
        if (postFolder == null)
        {
          var directoryName = $"{post.PublishedDate:yyyy-MM-dd}-{slug}";
          postFolder = Path.Combine(postsRoot, directoryName);
        }

        var assetsDirectory = Path.Combine(postFolder, "assets");
        Directory.CreateDirectory(assetsDirectory);

        foreach (var image in updatedData.Images)
        {
          if (image == null || image.Length <= 0) continue;
          try
          {
            var savedFileName = await ImageService.SaveAndCompressAsync(image, assetsDirectory);
            var imageUrl = $"/api/posts/{slug}/assets/{savedFileName}";
            finalImages.Add(imageUrl);
          }
          catch (Exception ex)
          {
            _logger.LogError(ex, "Error saving modified image: {FileName}", image.FileName);
          }
        }
      }

      // Ensure consistent secure URLs and de-duplication
      post.Images = finalImages
        .Where(s => !string.IsNullOrWhiteSpace(s))
        .Select(s => s.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();

      bool success = await _postRepository.UpdatePostAsync(post);
      return success ? (true, "Post updated successfully") : (false, "Failed to update post");
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error modifying post: {Slug}", slug);
      return (false, "An error occurred while updating the post");
    }
  }

  public async Task<(bool Success, string Message)> PublishPostAsync(string slug, string currentUsername)
  {
    try
    {
      var post = await _postRepository.GetPostBySlugAsync(slug);
      if (post == null)
      {
        return (false, "Post not found");
      }

      if (post.Author != currentUsername)
      {
        return (false, "Unauthorized");
      }

      // Only increment user's published count when transitioning from unpublished -> published
      bool wasPublished = post.IsPublished;
      post.IsPublished = true;
      post.PublishedDate = DateTime.UtcNow;
      post.LastModified = DateTime.UtcNow;

      bool success = await _postRepository.UpdatePostAsync(post);

      if (success && !wasPublished)
      {
        try
        {
          var user = await _userRepository.GetUserByUsernameAsync(currentUsername);
          if (user != null)
          {
            user.PublishedPostsCount = (user.PublishedPostsCount < 0) ? 1 : user.PublishedPostsCount + 1;
            await _userRepository.UpdateUserAsync(user);
          }
        }
        catch (Exception ex)
        {
          // Log and continue; publish already succeeded.
          _logger.LogWarning(ex, "Failed to increment PublishedPostsCount for user: {User}", currentUsername);
        }
      }

      return success ? (true, "Post published successfully") : (false, "Failed to publish post");
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error publishing post: {Slug}", slug);
      return (false, "An error occurred while publishing the post");
    }
  }

  public async Task<Post?> GetPostByIdAsync(string postId)
  {
    try
    {
      return await _postRepository.GetPostBySlugAsync(postId);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting post by ID: {PostId}", postId);
      return null;
    }
  }

  public async Task<bool> DeletePostAsync(string slug)
  {
    try
    {
      var post = await _postRepository.GetPostBySlugAsync(slug);
      if (post == null) return false;

      bool wasPublished = post.IsPublished;

      var deleted = await _postRepository.DeletePostAsync(slug);

      // If post was published, decrement the author's published count
      if (deleted && wasPublished)
      {
        try
        {
          var user = await _userRepository.GetUserByUsernameAsync(post.Author);
          if (user != null)
          {
            user.PublishedPostsCount = Math.Max(0, user.PublishedPostsCount - 1);
            await _userRepository.UpdateUserAsync(user);
          }
        }
        catch (Exception ex)
        {
          _logger.LogWarning(ex, "Failed to decrement PublishedPostsCount for user after delete: {User}", post.Author);
        }
      }

      return deleted;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error deleting post: {Slug}", slug);
      return false;
    }
  }

  public async Task<(bool Success, string Message)> UnpublishPostAsync(string slug, string currentUsername)
  {
    try
    {
      var post = await _postRepository.GetPostBySlugAsync(slug);
      if (post == null)
      {
        return (false, "Post not found");
      }

      if (post.Author != currentUsername)
      {
        return (false, "Unauthorized");
      }

      if (!post.IsPublished)
      {
        return (true, "Post already unpublished");
      }

      post.IsPublished = false;
      post.LastModified = DateTime.UtcNow;

      bool success = await _postRepository.UpdatePostAsync(post);

      if (success)
      {
        try
        {
          var user = await _userRepository.GetUserByUsernameAsync(currentUsername);
          if (user != null)
          {
            user.PublishedPostsCount = Math.Max(0, user.PublishedPostsCount - 1);
            await _userRepository.UpdateUserAsync(user);
          }
        }
        catch (Exception ex)
        {
          _logger.LogWarning(ex, "Failed to decrement PublishedPostsCount for user: {User}", currentUsername);
        }
      }

      return success ? (true, "Post unpublished successfully") : (false, "Failed to unpublish post");
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error unpublishing post: {Slug}", slug);
      return (false, "An error occurred while unpublishing the post");
    }
  }

  public IEnumerable<Post> GetAllPostsIncludingDrafts()
  {
    try
    {
      return _postRepository.GetAllPostsAsync().Result;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting all posts including drafts");
      return Enumerable.Empty<Post>();
    }
  }

  public IEnumerable<Post> GetPostsByUser(string username, string? currentUsername = null)
  {
    try
    {
      var posts = _postRepository.GetPostsByUserAsync(username).Result;

      // Filter out unpublished posts unless it's the author viewing
      if (currentUsername != username)
      {
        posts = posts.Where(p => p.IsPublished);
      }

      var list = posts.ToList();
      if (!string.IsNullOrEmpty(currentUsername))
      {
        foreach (var p in list)
        {
          p.LikedByCurrentUser = p.Likes.Any(l => l.Equals(currentUsername, StringComparison.OrdinalIgnoreCase));
        }
      }
      return list;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting posts by user: {Username}", username);
      return Enumerable.Empty<Post>();
    }
  }

  // Like methods
  public IResult LikePost(string slug, string currentUsername, NotificationService notificationService)
  {
    try
    {
      var post = _postRepository.GetPostBySlugAsync(slug).Result;
      if (post == null)
      {
        return Results.NotFound(new { message = "Post not found." });
      }

      var success = _postRepository.LikePostAsync(slug, currentUsername).Result;
      if (!success)
      {
        return Results.BadRequest(new { message = "Failed to like post." });
      }

      // Send notification to author (best-effort)
      if (!post.Author.Equals(currentUsername, StringComparison.OrdinalIgnoreCase))
      {
        _ = notificationService.SendNotificationAsync(
          post.Author,
          $"Your post '{post.Title}' was liked by {currentUsername}.",
          $"/post/{slug}");
      }

      var likeCount = _postRepository.GetPostLikesAsync(slug).Result.Count();
      return Results.Ok(new { likeCount });
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error liking post: {Slug}", slug);
      return Results.Problem("Unexpected error while liking post.");
    }
  }

  public IResult UnlikePost(string slug, string currentUsername)
  {
    try
    {
      var post = _postRepository.GetPostBySlugAsync(slug).Result;
      if (post == null)
      {
        return Results.NotFound(new { message = "Post not found." });
      }

      var success = _postRepository.UnlikePostAsync(slug, currentUsername).Result;
      if (!success)
      {
        return Results.BadRequest(new { message = "Failed to unlike post." });
      }

      var likeCount = _postRepository.GetPostLikesAsync(slug).Result.Count();
      return Results.Ok(new { likeCount });
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error unliking post: {Slug}", slug);
      return Results.Problem("Unexpected error while unliking post.");
    }
  }

  public IResult GetPostLikes(string slug)
  {
    try
    {
      var post = _postRepository.GetPostBySlugAsync(slug).Result;
      if (post == null)
      {
        return Results.NotFound(new { message = "Post not found." });
      }

      var likerUsernames = _postRepository.GetPostLikesAsync(slug).Result.ToList();
      // Enrich with basic profile info (best-effort)
      var enriched = likerUsernames.Select(name =>
      {
        try
        {
          var u = _userRepository.GetUserByUsernameAsync(name).Result;
          return new
          {
            username = name,
            displayName = u?.Username ?? name,
            profilePictureUrl = u?.ProfilePictureUrl ?? string.Empty
          };
        }
        catch
        {
          return new { username = name, displayName = name, profilePictureUrl = string.Empty };
        }
      });

      return Results.Ok(enriched);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting likes for post: {Slug}", slug);
      return Results.Problem("Unexpected error while retrieving likes.");
    }
  }

  private static string GenerateSlug(string title)
  {
    // Convert to lowercase and replace spaces with hyphens
    var slug = title.ToLowerInvariant();

    // Remove special characters except spaces and hyphens
    slug = Regex.Replace(slug, @"[^a-z0-9\s\-]", "");

    // Replace multiple spaces or hyphens with single hyphen
    slug = Regex.Replace(slug, @"[\s\-]+", "-");

    // Trim hyphens from start and end
    slug = slug.Trim('-');

    return slug;
  }
}
