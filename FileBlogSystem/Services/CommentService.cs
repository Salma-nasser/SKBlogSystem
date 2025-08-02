using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.IO;
using System.Collections.Generic;

namespace FileBlogSystem.Services;

public class CommentService : ICommentService
{
  private readonly string _postsDirectory;
  private readonly IBlogPostService _blogPostService;
  private readonly INotificationService _notificationService;

  public CommentService(IWebHostEnvironment env, IConfiguration configuration, IBlogPostService blogPostService, INotificationService notificationService)
  {
    string contentRoot = configuration["ContentDirectory"] ?? "Content";
    // Construct the full path to the 'posts' directory, where comments will be stored.
    _postsDirectory = Path.Combine(env.ContentRootPath, contentRoot, "posts");
    _blogPostService = blogPostService;
    _notificationService = notificationService;
  }

  public async Task<Comment?> AddCommentAsync(string postId, string content, string authorUsername)
  {
    var post = await _blogPostService.GetPostByIdAsync(postId);
    if (post == null)
    {
      return null; // Post not found
    }

    var commentsDirectory = Path.Combine(_postsDirectory, postId, "comments");
    Directory.CreateDirectory(commentsDirectory);

    var newComment = new Comment { Content = content, Author = authorUsername };

    var commentFilePath = Path.Combine(commentsDirectory, $"{newComment.Id}.json");
    var json = JsonSerializer.Serialize(newComment, new JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(commentFilePath, json);

    // Update comment count in post metadata
    var postMetaPath = Path.Combine(_postsDirectory, postId, "meta.json");
    if (File.Exists(postMetaPath))
    {
      var metaContent = await File.ReadAllTextAsync(postMetaPath);
      var metaNode = JsonNode.Parse(metaContent)?.AsObject();
      if (metaNode != null)
      {
        // Safely parse existing commentCount
        var countNode = metaNode["commentCount"];
        int count = 0;
        if (countNode != null && int.TryParse(countNode.ToString(), out var parsed))
        {
          count = parsed;
        }
        metaNode["commentCount"] = count + 1;
        await File.WriteAllTextAsync(postMetaPath, metaNode.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
      }
    }

    // Send notification to the post author, but not if they are commenting on their own post.
    if (!string.Equals(post.Author, authorUsername, StringComparison.OrdinalIgnoreCase))
    {
      var message = $"User '{authorUsername}' commented on your post: '{post.Title}'.";
      var link = $"/post/{post.Slug}"; // Use the post's slug for a user-friendly link
      await _notificationService.SendNotificationAsync(post.Author, message, link);
    }
    return newComment;
  }
  // Retrieve all comments for a given post
  public async Task<List<Comment>> GetCommentsAsync(string postId)
  {
    var comments = new List<Comment>();
    var commentsDirectory = Path.Combine(_postsDirectory, postId, "comments");
    if (!Directory.Exists(commentsDirectory)) return comments;
    var files = Directory.GetFiles(commentsDirectory, "*.json");
    foreach (var file in files)
    {
      var json = await File.ReadAllTextAsync(file);
      var comment = JsonSerializer.Deserialize<Comment>(json);
      if (comment != null) comments.Add(comment);
    }
    comments.Sort((a, b) => a.CreatedAt.CompareTo(b.CreatedAt));
    return comments;
  }
}