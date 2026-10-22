"""Fetch identity metadata for every cited reference into data/reference-records.json.

The identifiers come from data/neuropsychology.yaml, data/circuits.yaml,
config/functional-regions.yaml, config/neuropsych-domains.yaml and
docs/reference/references.md. PubMed gives each
PMID's title, authors, issue year, DOI and erratum links; Bookshelf gives each NBK
chapter's; Crossref supplies a DOI that PubMed lacks and the DOI of each correction
notice. Abstracts are not stored. The reference tests read only the written file.

    uv run python scripts/fetch_references.py
"""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/reference-records.json"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
CROSSREF = "https://api.crossref.org/works"
HEADERS = {"User-Agent": "NeuroAtlas reference check (https://github.com/JoshuaDuq/neuroatlas)"}
# NCBI allows three requests a second without a key; Crossref's public pool, one.
PAUSE_S = {"eutils": 0.5, "crossref": 1.2}
RETRIES_ON_429 = 3
YEAR_BASIS = (
    "PubMed's journal-issue publication year (PubDate, or the first year of a MedlineDate "
    "range), not the online-first year; for a Bookshelf chapter, the book's publication year"
)
# PubMed's links from an article to a notice that amends it.
NOTICE_TYPES = {
    "ErratumIn": "erratum",
    "CorrectedandRepublishedIn": "corrected and republished",
    "RetractionIn": "retraction",
    "ExpressionOfConcernIn": "expression of concern",
}
DOI_IN_MARKDOWN = re.compile(r"\[doi:(10\.[^\]]+)\]")
PMID_IN_MARKDOWN = re.compile(r"\bPMID (\d+)\b")
# "Cereb Cortex. 2006 Oct;16(10):1529" -> volume 16, first page 1529.
NOTICE_LOCATION = re.compile(r";\s*(\d+)(?:\([^)]*\))?:\s*([A-Za-z]?\d+)")


def get(url, service="eutils"):
    request = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(RETRIES_ON_429 + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
            break
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == RETRIES_ON_429:
                raise
            time.sleep(float(error.headers.get("Retry-After", 10)))
    time.sleep(PAUSE_S[service])
    return body


def crossref(path, **query):
    url = f"{CROSSREF}/{path}" if path else CROSSREF
    if query:
        url += "?" + urllib.parse.urlencode(query)
    return json.loads(get(url, "crossref"))["message"]


def text(element):
    return re.sub(r"\s+", " ", "".join(element.itertext())).strip().removesuffix(".")


def cited_identifiers():
    """PMIDs, Bookshelf accessions and, by PMID, the DOI each citation gives."""
    pmids, books, dois = set(), set(), {}
    clinical = yaml.safe_load((ROOT / "data/neuropsychology.yaml").read_text())
    for reference in clinical["references"]:
        pmids.add(reference["pmid"])
        dois[reference["pmid"]] = reference["doi"]
    circuits = yaml.safe_load((ROOT / "data/circuits.yaml").read_text())
    for reference in circuits["references"]:
        if "nbk" in reference:
            books.add(reference["nbk"])
        else:
            pmids.add(reference["pmid"])
    for config in ("functional-regions", "neuropsych-domains"):
        sources = yaml.safe_load((ROOT / f"config/{config}.yaml").read_text())["sources"]
        for source in sources.values():
            pmid = str(source["pmid"])
            pmids.add(pmid)
            dois[pmid] = source["doi"].removeprefix("https://doi.org/")
    for line in (ROOT / "docs/reference/references.md").read_text().splitlines():
        doi, pmid = DOI_IN_MARKDOWN.search(line), PMID_IN_MARKDOWN.search(line)
        if doi and not pmid:
            raise ValueError(f"references.md cites {doi[1]} without a PMID")
        if pmid:
            pmids.add(pmid[1])
        if pmid and doi:
            dois[pmid[1]] = doi[1]
    return sorted(pmids, key=int), sorted(books), dois


def pubmed_articles(pmids):
    articles = {}
    for start in range(0, len(pmids), 100):
        batch = pmids[start:start + 100]
        root = ET.fromstring(get(f"{EUTILS}efetch.fcgi?db=pubmed&retmode=xml&id={','.join(batch)}"))
        for article in root.findall("PubmedArticle"):
            articles[article.findtext("MedlineCitation/PMID")] = article
    missing = sorted(set(pmids) - set(articles), key=int)
    if missing:
        raise ValueError(f"PubMed returned no record for {missing}")
    return articles


def pubmed_year(issue):
    year = issue.findtext("PubDate/Year") or issue.findtext("PubDate/MedlineDate")
    return int(re.match(r"\d{4}", year)[0])


def pubmed_date(issue):
    date_element = issue.find("PubDate")
    medline = date_element.findtext("MedlineDate")
    if medline:
        return medline
    return " ".join(date_element.findtext(part) for part in ("Year", "Month", "Day")
                    if date_element.findtext(part))


def author_name(author):
    if author.findtext("CollectiveName"):
        return author.findtext("CollectiveName")
    return " ".join(part for part in (author.findtext("LastName"), author.findtext("Initials"),
                                      author.findtext("Suffix")) if part)


def same_work(work, title, first_author):
    """Crossref and PubMed agree on a work's title and first author's surname."""
    def plain(value):
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    surname = next((a["family"] for a in work.get("author", []) if a.get("sequence") == "first"), "")
    return (plain(work["title"][0]) == plain(title)
            and first_author.lower().startswith(surname.lower() + " "))


def notices(article, doi, title, issn):
    """Correction and retraction notices: PubMed's links, each resolved to a DOI by Crossref."""
    linked = []
    if doi:
        for item in crossref("", filter=f"updates:{doi}", rows=20)["items"]:
            for update in item["update-to"]:
                if update["DOI"].lower() == doi.lower():
                    linked.append({"type": update["type"], "doi": item["DOI"].lower(),
                                   "volume": item.get("volume"), "page": item.get("page", "")})
    found = []
    for comment in article.findall("MedlineCitation/CommentsCorrectionsList/CommentsCorrections"):
        kind = NOTICE_TYPES.get(comment.get("RefType"))
        if not kind:
            continue
        citation = comment.findtext("RefSource")
        volume, page = NOTICE_LOCATION.search(citation).groups()
        match = [item for item in linked
                 if item["volume"] == volume and item["page"].split("-")[0] == page]
        if not match:
            # Crossref has no update link for some older notices; they share the title.
            items = crossref("", **{"query.bibliographic": title, "filter": f"issn:{issn}", "rows": 20})["items"]
            match = [{"type": kind, "doi": item["DOI"].lower()} for item in items
                     if item.get("volume") == volume and item.get("page", "").split("-")[0] == page]
        if len(match) != 1:
            raise ValueError(f"Cannot resolve the {kind} '{citation}' to one DOI")
        linked = [item for item in linked if item["doi"] != match[0]["doi"]]
        found.append({"type": kind, "citation": citation, "doi": match[0]["doi"],
                      "pmid": comment.findtext("PMID")})
    for item in linked:
        found.append({"type": item["type"], "citation": None, "doi": item["doi"], "pmid": None})
    return found


def article_record(pmid, article, cited_doi):
    citation = article.find("MedlineCitation/Article")
    issue = citation.find("Journal/JournalIssue")
    ids = {item.get("IdType"): item.text for item in article.findall("PubmedData/ArticleIdList/ArticleId")}
    title = text(citation.find("ArticleTitle"))
    authors = [author_name(author) for author in citation.findall("AuthorList/Author")]
    doi, doi_source = ids.get("doi"), "pubmed"
    if not doi and cited_doi:
        if not same_work(crossref(urllib.parse.quote(cited_doi)), title, authors[0]):
            raise ValueError(f"PMID {pmid}: Crossref's {cited_doi} is a different work")
        doi, doi_source = cited_doi, "crossref"
    issn = citation.findtext("Journal/ISSN")
    return {
        "pmid": pmid,
        "pmcid": ids.get("pmc"),
        "doi": doi.lower() if doi else None,
        "doi_source": doi_source if doi else None,
        "title": title,
        "authors": authors,
        "year": pubmed_year(issue),
        "pubdate": pubmed_date(issue),
        "journal": citation.findtext("Journal/ISOAbbreviation"),
        "volume": issue.findtext("Volume"),
        "issue": issue.findtext("Issue"),
        "pages": citation.findtext("Pagination/MedlinePgn"),
        "corrections": notices(article, doi, title, issn),
    }


def book_record(accession):
    found = json.loads(get(f"{EUTILS}esearch.fcgi?db=books&retmode=json&term={accession}"))
    summaries = json.loads(get(
        f"{EUTILS}esummary.fcgi?db=books&retmode=json&id={','.join(found['esearchresult']['idlist'])}"))
    # A section's tables and figures share its accession; the section itself is the citation.
    chapters = [summaries["result"][uid] for uid in summaries["result"]["uids"]
                if summaries["result"][uid]["accessionid"] == accession
                and summaries["result"][uid]["rtype"] in ("chapter", "sec")]
    if len(chapters) != 1:
        raise ValueError(f"Bookshelf has {len(chapters)} chapters for {accession}")
    info = ET.fromstring(chapters[0]["bookinfo"])
    parent = info.find("Citation/ParentRecord")
    editors = parent.findtext("Contributors").removesuffix(", editors.").split(", ")
    return {
        "nbk": accession,
        "title": text(info.find("Citation/MainRecord/Title")),
        "book": text(parent.find("Title")),
        "editors": editors,
        "year": int(re.search(r"(\d{4})\.?$", parent.findtext("PublicationStatement"))[1]),
        "publisher": parent.findtext("PublicationStatement").removesuffix("."),
        "corrections": [],
    }


def main():
    pmids, books, dois = cited_identifiers()
    records = {f"nbk:{accession}": book_record(accession) for accession in books}
    articles = pubmed_articles(pmids)
    records |= {f"pmid:{pmid}": article_record(pmid, articles[pmid], dois.get(pmid)) for pmid in pmids}
    OUTPUT.write_text(json.dumps({
        "fetched": datetime.now().astimezone().date().isoformat(),
        "sources": "PubMed efetch, Bookshelf esummary and Crossref; no abstracts",
        "year": YEAR_BASIS,
        "records": records,
    }, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(records)} records written to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
