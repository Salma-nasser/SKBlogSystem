namespace FileBlogSystem.Models;

public class CreatePostRequest
{
  public string Title { get; set; } = string.Empty;
  public string Description { get; set; } = string.Empty;
  public string Body { get; set; } = string.Empty;
  public List<string> Tags { get; set; } = new();
  public List<string> Categories { get; set; } = new();
  public string? CustomUrl { get; set; }
  public bool? IsPublished { get; set; }
  public DateTime? ScheduledDate { get; set; }
  public List<IFormFile>? Images { get; set; }
  public List<string>? KeptImages { get; set; } = new(); // Add this property
}