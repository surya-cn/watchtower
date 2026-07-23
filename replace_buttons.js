const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/components/config/ConfigForm.tsx',
  'src/components/AIChatBar.tsx',
  'src/components/IssueDetailSlideOver.tsx',
  'src/components/IssuesTable.tsx',
  'src/components/SimilarPostsSlideOver.tsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace import
  content = content.replace(/import SpecularButton from ['"][^'"]+SpecularButton(\/SpecularButton)?['"];?/g, "import Button from '@/components/Button/Button';");
  
  // Custom variants based on colors
  content = content.replace(/<SpecularButton([^>]+)baseColor="#aa4444"([^>]*)>/g, '<Button variant="danger"$1$2>');
  content = content.replace(/<SpecularButton([^>]+)baseColor="#3a5acc"([^>]*)>/g, '<Button variant="primary"$1$2>');
  content = content.replace(/<SpecularButton([^>]+)baseColor="#222"([^>]*)>/g, '<Button variant="ghost"$1$2>');
  
  // Catch any remaining SpecularButton tags
  content = content.replace(/<SpecularButton/g, '<Button');
  content = content.replace(/<\/SpecularButton>/g, '</Button>');
  
  // Remove specular-specific props
  const propsToRemove = [
    /radius=\{[^}]+\}/g,
    /tint=['"][^'"]+['"]/g,
    /tintOpacity=\{[^}]+\}/g,
    /lineColor=['"][^'"]+['"]/g,
    /baseColor=['"][^'"]+['"]/g,
    /intensity=\{[^}]+\}/g,
    /followMouse/g,
    /proximity=\{[^}]+\}/g
  ];
  
  propsToRemove.forEach(regex => {
    // We only want to remove these if they are inside a <Button ... > tag.
    // The easiest way is to just global replace since these prop names are highly specific to SpecularButton.
    content = content.replace(regex, '');
  });
  
  // Clean up empty lines inside Button tags left by prop removal
  // A bit hacky but works: replace multiple spaces/newlines inside tags.
  content = content.replace(/(<Button[^>]*>)/g, (match) => {
    return match.replace(/\s+/g, ' ').replace(/ >/g, '>');
  });

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${file}`);
});
