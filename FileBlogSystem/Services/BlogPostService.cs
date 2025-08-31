using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using FileBlogSystem.Repositories.Interfaces;

namespace FileBlogSystem.Services;

public class BlogPostService : IBlogPostService
{
  private readonly IPostRepository _postRepository;
  private readonly IUserRepository _userRepository;
  private readonly ILogger<BlogPostService> _logger;

  public BlogPostService(
      IPostRepository postRepository,
      IUserRepository userRepository,
      ILogger<BlogPostService> logger)
  {
    _postRepository = postRepository;
    _userRepository = userRepository;
    _logger = logger;
  }

  public IEnumerable<Post> GetAllPosts(string? currentUsername = null)
  {
    try
    {
      var posts = _postRepository.GetAllPostsAsync().Result;
      return posts.Where(p => p.IsPublished || (currentUsername != null && p.Author == currentUsername));
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
      var post = new Post(
          title: request.Title,
          description: request.Description,
          body: request.Body,
          author: authorUsername,
          publishedDate: (request.IsPublished ?? false) ? DateTime.UtcNow : DateTime.MinValue,
          lastModified: DateTime.UtcNow,
          tags: request.Tags ?? new List<string>(),
          categories: request.Categories ?? new List<string>(),
          slug: "", // Will be set by repository
          isPublished: request.IsPublished ?? false,
          scheduledDate: request.ScheduledDate
      );

      string postId = await _postRepository.CreatePostAsync(post);
      post.Slug = postId; // Assuming the repository generates a slug as ID

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

      return posts;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error getting posts by user: {Username}", username);
      return Enumerable.Empty<Post>();
    }
  }

  // Like methods - these may need to be implemented based on your requirements
  public IResult LikePost(string slug, string currentUsername, NotificationService notificationService)
  {
    // TODO: Implement like functionality
    // This would require additional data storage for likes
    return Results.NotFound("Like functionality not implemented");
  }

  public IResult UnlikePost(string slug, string currentUsername)
  {
    // TODO: Implement unlike functionality
    // This would require additional data storage for likes
    return Results.NotFound("Unlike functionality not implemented");
  }

  public IResult GetPostLikes(string slug)
  {
    // TODO: Implement get likes functionality
    // This would require additional data storage for likes
    return Results.Ok(new { likes = 0 });
  }
}
