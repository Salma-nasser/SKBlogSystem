using System.ComponentModel.DataAnnotations;

namespace FileBlogSystem.Models;

public class AddCommentDto
{
    [Required]
    [MinLength(1)]
    public string Content { get; set; } = string.Empty;
}