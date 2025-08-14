using FileBlogSystem.Models;

namespace FileBlogSystem.Interfaces
{
  public interface ISearchService
  {
    // Completely rebuild the index from the provided posts (published only)
    void RebuildIndex(IEnumerable<Post> posts);

    // Search the index and return matching slugs ordered by relevance
    IReadOnlyList<(string Slug, float Score)> Search(string query, string? filterType = null, string? filterValue = null);
  }
}
