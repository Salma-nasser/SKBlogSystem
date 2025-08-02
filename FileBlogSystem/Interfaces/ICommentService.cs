using FileBlogSystem.Models;

namespace FileBlogSystem.Services;

public interface ICommentService
{
    Task<Comment?> AddCommentAsync(string postId, string content, string authorUsername);
    // Retrieve all comments for a given post
    Task<List<Comment>> GetCommentsAsync(string postId);
}