namespace FileBlogSystem.Models;

public class CreatePostRequest
{
  public string Title { get; set; } = string.Empty;
  public string Description { get; set; } = string.Empty;
  public string Body { get; set; } = string.Empty;
  public List<string> Tags { get; set; } = new List<string>();
  public List<string> Categories { get; set; } = new List<string>();
  public string CustomUrl { get; set; } = string.Empty;
  public bool? IsPublished { get; set; } = false;
  public DateTime? ScheduledDate { get; set; }
  public List<IFormFile>? Images { get; set; }

}