using FileBlogSystem.Interfaces;
using FileBlogSystem.Models;
using Lucene.Net.Analysis.Standard;
using Lucene.Net.Documents;
using Lucene.Net.Index;
using Lucene.Net.QueryParsers.Classic;
using Lucene.Net.Search;
using Lucene.Net.Store;
using Lucene.Net.Util;

namespace FileBlogSystem.Services;

public class LuceneSearchService : ISearchService, IDisposable
{
  private readonly string _indexPath;
  private readonly FSDirectory _directory;
  private readonly StandardAnalyzer _analyzer;
  private IndexWriter? _writer;
  private static readonly object _sync = new();
  private const LuceneVersion AppLuceneVersion = LuceneVersion.LUCENE_48;

  public LuceneSearchService(IWebHostEnvironment env)
  {
    _indexPath = System.IO.Path.Combine(env.ContentRootPath, "Content", "search-index");
    System.IO.Directory.CreateDirectory(_indexPath);
    _directory = FSDirectory.Open(_indexPath);
    _analyzer = new StandardAnalyzer(AppLuceneVersion);
  }

  private IndexWriter GetWriter()
  {
    lock (_sync)
    {
      if (_writer == null)
      {
        var config = new IndexWriterConfig(AppLuceneVersion, _analyzer)
        {
          OpenMode = OpenMode.CREATE_OR_APPEND
        };
        _writer = new IndexWriter(_directory, config);
      }
      return _writer;
    }
  }

  public void RebuildIndex(IEnumerable<Post> posts)
  {
    var writer = GetWriter();
    lock (_sync)
    {
      writer.DeleteAll();
      foreach (var p in posts)
      {
        // Only index published posts
        if (!p.IsPublished) continue;
        var doc = new Document
                {
                    // Store slug for retrieval
                    new StringField("slug", p.Slug ?? string.Empty, Field.Store.YES),
                    // Index title/description/body for full-text
                    new TextField("title", p.Title ?? string.Empty, Field.Store.NO),
                    new TextField("description", p.Description ?? string.Empty, Field.Store.NO),
                    new TextField("body", p.Body ?? string.Empty, Field.Store.NO),
                    new StringField("author", p.Author ?? string.Empty, Field.Store.NO),
                    // These are used by the multi-field parser for free-text search
                    new TextField("tags", string.Join(" ", p.Tags ?? new List<string>()), Field.Store.NO),
                    new TextField("categories", string.Join(" ", p.Categories ?? new List<string>()), Field.Store.NO)
                };
        // Add exact-match filter fields for each tag/category
        if (p.Tags != null)
        {
          foreach (var tag in p.Tags)
          {
            if (!string.IsNullOrWhiteSpace(tag))
              doc.Add(new StringField("tag", tag, Field.Store.NO));
          }
        }
        if (p.Categories != null)
        {
          foreach (var cat in p.Categories)
          {
            if (!string.IsNullOrWhiteSpace(cat))
              doc.Add(new StringField("category", cat, Field.Store.NO));
          }
        }
        writer.AddDocument(doc);
      }
      writer.Flush(triggerMerge: false, applyAllDeletes: true);
      writer.Commit();
    }
  }

  public IReadOnlyList<(string Slug, float Score)> Search(string query, string? filterType = null, string? filterValue = null)
  {
    // Empty query returns everything ordered by recency not supported here; fallback to match all
    var searcher = new IndexSearcher(DirectoryReader.Open(_directory));
    var parser = new MultiFieldQueryParser(AppLuceneVersion, new[] { "title", "description", "body", "tags", "categories" }, _analyzer)
    {
      DefaultOperator = Operator.AND
    };
    Query mainQuery;
    if (string.IsNullOrWhiteSpace(query))
    {
      mainQuery = new MatchAllDocsQuery();
    }
    else
    {
      try { mainQuery = parser.Parse(query); }
      catch (ParseException)
      {
        // Escape if parse fails
        mainQuery = parser.Parse(QueryParserBase.Escape(query));
      }
    }

    // Optional filter
    Query? filterQuery = null;
    if (!string.IsNullOrWhiteSpace(filterType) && !string.IsNullOrWhiteSpace(filterValue))
    {
      switch (filterType)
      {
        case "tag":
          filterQuery = new TermQuery(new Term("tag", filterValue));
          break;
        case "category":
          filterQuery = new TermQuery(new Term("category", filterValue));
          break;
      }
    }

    Query finalQuery = filterQuery == null ? mainQuery : new BooleanQuery
        {
            { mainQuery, Occur.MUST },
            { filterQuery, Occur.MUST }
        };

    var topDocs = searcher.Search(finalQuery, 200);
    var results = new List<(string Slug, float Score)>(topDocs.ScoreDocs.Length);
    foreach (var sd in topDocs.ScoreDocs)
    {
      var doc = searcher.Doc(sd.Doc);
      var slug = doc.Get("slug") ?? string.Empty;
      results.Add((slug, sd.Score));
    }
    return results;
  }

  public void Dispose()
  {
    lock (_sync)
    {
      _writer?.Dispose();
      _directory?.Dispose();
      _analyzer?.Dispose();
    }
  }
}
