namespace FileBlogSystem.Models;

public class Post
{
  public string Title { get; set; } = "";
  public string Description { get; set; } = "";
  public string Body { get; set; } = "";
  public string Author { get; set; } = "";
  public DateTime PublishedDate { get; set; }
  public DateTime? LastModified { get; set; }
  public List<string> Tags { get; set; } = new List<string>();
  public List<string> Categories { get; set; } = new List<string>();
  public string Slug { get; set; } = "";
  public bool IsPublished { get; set; }
  public DateTime? ScheduledDate { get; set; }
  public List<string> Images { get; set; } = new List<string>();
  public List<string> Likes { get; set; } = new List<string>();
  public bool LikedByCurrentUser { get; set; }
  public int CommentCount { get; set; }

  public Post(string title, string description, string body, string author, DateTime publishedDate, DateTime? lastModified,
              List<string> tags, List<string> categories, string slug, bool isPublished, DateTime? scheduledDate)
  {
    Title = title;
    Description = description;
    Body = body;
    Author = author;
    PublishedDate = publishedDate;
    LastModified = lastModified;
    Tags = tags;
    Categories = categories;
    Slug = slug;
    IsPublished = isPublished;
    ScheduledDate = scheduledDate;
    Images = new List<string>();
    Likes = new List<string>();
    LikedByCurrentUser = false;
    CommentCount = 0;
  }
}

