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

      var imageMarkdown = new List<string>();

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

              // Add markdown for the image to embed in content
              var altText = Path.GetFileNameWithoutExtension(savedFileName);
              imageMarkdown.Add($"![{altText}]({imageUrl})");
            }
            catch (Exception ex)
            {
              _logger.LogError(ex, "Error saving image: {FileName}", image.FileName);
            }
          }
        }
      }

      // Append images to the post body if any were uploaded
      if (imageMarkdown.Any())
      {
        post.Body += "\n\n" + string.Join("\n\n", imageMarkdown);
      }

      // Persist the post (repository should not change slug)
      string postId = await _postRepository.CreatePostAsync(post);
      if (string.IsNullOrEmpty(postId))
      {
        // Fall back to slug if repository returns empty
        postId = finalSlug;
      }
      post.Slug = finalSlug;

      return new { success = true, slug = post.Slug, message = "Post created successfully" };
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error creating post");
      return new { success = false, message = "Failed to create post" };
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

      post.IsPublished = true;
      post.PublishedDate = DateTime.UtcNow;
      post.LastModified = DateTime.UtcNow;

      bool success = await _postRepository.UpdatePostAsync(post);
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
      return await _postRepository.DeletePostAsync(slug);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error deleting post: {Slug}", slug);
      return false;
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
