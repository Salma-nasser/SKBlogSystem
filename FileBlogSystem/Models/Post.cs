namespace FileBlogSystem.Models;

public class Post
{
  public string Title { get; set; }
  public string Description { get; set; }
  public string Body { get; set; }
  public User Author { get; set; }
  public DateTime PublishedDate { get; set; }
  public DateTime LastModified { get; set; }

  public Post (string title, string description, string body, User author)
{
  Title = title;
  Description = description;
  Body = body;
  Author = author;
  PublishedDate = DateTime.UtcNow;
  LastModified = DateTime.UtcNow;
}
}
