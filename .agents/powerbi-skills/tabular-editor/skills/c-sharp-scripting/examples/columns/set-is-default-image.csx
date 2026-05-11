/*
 * Title: Set IsDefaultImage Property
 *
 * Description: Marks a column as the default image for the table in CSDL.
 *
 * WHEN TO USE:
 * - Specify which image column represents the entity (product, person, etc.)
 * - Enable Power BI to automatically use the image in card visuals
 * - Improve user experience by setting representative images
 * - Support entity visualization in composite models
 *
 * PREREQUISITE: Column must have DataCategory set to an image type
 * (Image, ImageURL, ImageBMP, ImageGIF, ImageJPG, ImagePNG, ImageTIFF)
 *
 * Usage: Configure default image columns below.
 * CLI: te "workspace/model" set-is-default-image.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Map: Table Name → Image Column Name
var defaultImageColumns = new Dictionary<string, string>
{
    { "DimProduct", "ProductImageURL" },
    { "DimEmployee", "EmployeePhoto" },
    { "DimCustomer", "CustomerAvatar" },
    { "DimStore", "StorePhoto" }
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var updatedCount = 0;

foreach(var entry in defaultImageColumns)
{
    var tableName = entry.Key;
    var imageColumnName = entry.Value;

    if(!Model.Tables.Contains(tableName))
    {
        Info("⚠ Table not found: " + tableName);
        continue;
    }

    var table = Model.Tables[tableName];

    if(!table.Columns.Contains(imageColumnName))
    {
        Info("⚠ Column not found: " + tableName + "[" + imageColumnName + "]");
        continue;
    }

    var column = table.Columns[imageColumnName];

    // Set DataCategory if not already an image type
    if(string.IsNullOrEmpty(column.DataCategory) ||
       !column.DataCategory.StartsWith("Image"))
    {
        column.DataCategory = "ImageURL";
        Info("  Set DataCategory = ImageURL for " + imageColumnName);
    }

    // Mark as default image
    column.IsDefaultImage = true;
    updatedCount++;

    Info("✓ Set default image: " + tableName + "[" + imageColumnName + "]");
}

Info("\nConfigured " + updatedCount + " default image columns");

// ============================================================================
// NOTES
// ============================================================================

Info("\nREQUIREMENTS:");
Info("  - Column must have image DataCategory:");
Info("    Image, ImageURL, ImageBMP, ImageGIF, ImageJPG, ImagePNG, ImageTIFF");
Info("  - Only one column per table should be IsDefaultImage = true");
Info("");
Info("USE CASES:");
Info("  - Product images in catalog");
Info("  - Employee photos in org charts");
Info("  - Customer avatars");
Info("  - Store/location photos");
