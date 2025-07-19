using FileBlogSystem.Models;

namespace FileBlogSystem.Interfaces
{
    public interface IBlogPostService
    {
        IEnumerable<Post> GetAllPosts(string? currentUsername = null);
        IEnumerable<Post> GetPostsByCategory(string category, string currentUsername);
        IEnumerable<Post> GetPostsByTag(string tag, string currentUsername);
        Post? GetPostBySlug(string slug, string? currentUsername);
        IEnumerable<Post> GetUserDrafts(string username);
        Task<dynamic> CreatePostAsync(CreatePostRequest request, string authorUsername);
        Task<(bool Success, string Message)> ModifyPostAsync(string slug, CreatePostRequest updatedData, string currentUsername);
        Task<(bool Success, string Message)> PublishPostAsync(string slug, string currentUsername);
        Task<bool> DeletePostAsync(string slug);
        IEnumerable<Post> GetAllPostsIncludingDrafts();
        IEnumerable<Post> GetPostsByUser(string username, string? currentUsername = null);
        // Like methods
        IResult LikePost(string slug, string currentUsername);
        IResult UnlikePost(string slug, string currentUsername);
        IResult GetPostLikes(string slug);
    }
}
