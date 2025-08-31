using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using FileBlogSystem.Repositories.Interfaces;

namespace FileBlogSystem.Services;

public class CommentService : ICommentService
{
    private readonly ICommentRepository _commentRepository;
    private readonly IPostRepository _postRepository;
    private readonly INotificationService _notificationService;
    private readonly ILogger<CommentService> _logger;

    public CommentService(
        ICommentRepository commentRepository,
        IPostRepository postRepository,
        INotificationService notificationService,
        ILogger<CommentService> logger)
    {
        _commentRepository = commentRepository;
        _postRepository = postRepository;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<Comment?> AddCommentAsync(string postSlug, string content, string authorUsername)
    {
        try
        {
            // Check if post exists
            var post = await _postRepository.GetPostBySlugAsync(postSlug);
            if (post == null)
            {
                return null; // Post not found
            }

            // Create new comment
            var newComment = new Comment
            {
                Content = content,
                Author = authorUsername,
                CreatedAt = DateTime.UtcNow
            };

            // Save comment
            string commentId = await _commentRepository.CreateCommentAsync(postSlug, newComment);
            newComment.Id = commentId;

            // Send notification to post author if it's not the same user
            if (!post.Author.Equals(authorUsername, StringComparison.OrdinalIgnoreCase))
            {
                await _notificationService.SendNotificationAsync(
                    post.Author,
                    $"{authorUsername} commented on your post '{post.Title}'",
                    $"/post/{postSlug}"
                );
            }

            return newComment;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding comment to post: {PostSlug}", postSlug);
            return null;
        }
    }

    public async Task<IEnumerable<Comment>> GetCommentsForPostAsync(string postSlug)
    {
        try
        {
            return await _commentRepository.GetCommentsByPostSlugAsync(postSlug);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comments for post: {PostSlug}", postSlug);
            return Enumerable.Empty<Comment>();
        }
    }

    public async Task<Comment?> GetCommentByIdAsync(string commentId)
    {
        try
        {
            return await _commentRepository.GetCommentByIdAsync(commentId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comment by ID: {CommentId}", commentId);
            return null;
        }
    }

    public async Task<bool> UpdateCommentAsync(string commentId, string newContent, string currentUsername)
    {
        try
        {
            var comment = await _commentRepository.GetCommentByIdAsync(commentId);
            if (comment == null)
            {
                return false;
            }

            // Check if user owns the comment
            if (!comment.Author.Equals(currentUsername, StringComparison.OrdinalIgnoreCase))
            {
                return false; // Unauthorized
            }

            comment.Content = newContent;

            // Find which post this comment belongs to by checking all posts
            // This is a temporary solution - ideally we'd store post reference
            var allPosts = await _postRepository.GetAllPostsAsync();
            foreach (var post in allPosts)
            {
                var postComments = await _commentRepository.GetCommentsByPostSlugAsync(post.Slug);
                if (postComments.Any(c => c.Id == commentId))
                {
                    return await _commentRepository.UpdateCommentAsync(post.Slug, comment);
                }
            }

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating comment: {CommentId}", commentId);
            return false;
        }
    }

    public async Task<bool> DeleteCommentAsync(string commentId, string currentUsername, bool isAdmin = false)
    {
        try
        {
            var comment = await _commentRepository.GetCommentByIdAsync(commentId);
            if (comment == null)
            {
                return false;
            }

            // Check if user owns the comment or is admin
            bool isOwner = comment.Author.Equals(currentUsername, StringComparison.OrdinalIgnoreCase);
            if (!isOwner && !isAdmin)
            {
                return false; // Unauthorized
            }

            return await _commentRepository.DeleteCommentAsync(commentId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting comment: {CommentId}", commentId);
            return false;
        }
    }

    public async Task<IEnumerable<Comment>> GetCommentsByUserAsync(string username)
    {
        try
        {
            return await _commentRepository.GetCommentsByUserAsync(username);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comments for user: {Username}", username);
            return Enumerable.Empty<Comment>();
        }
    }

    public async Task<int> GetCommentsCountForPostAsync(string postSlug)
    {
        try
        {
            return await _commentRepository.GetCommentsCountByPostSlugAsync(postSlug);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comments count for post: {PostSlug}", postSlug);
            return 0;
        }
    }

    public async Task<IEnumerable<Comment>> GetAllCommentsAsync()
    {
        try
        {
            return await _commentRepository.GetAllCommentsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all comments");
            return Enumerable.Empty<Comment>();
        }
    }

    public async Task<bool> ApproveCommentAsync(string commentId)
    {
        // Comment approval not supported in current model
        return await Task.FromResult(false);
    }

    public async Task<bool> RejectCommentAsync(string commentId)
    {
        // Comment rejection not supported in current model
        return await Task.FromResult(false);
    }
}
