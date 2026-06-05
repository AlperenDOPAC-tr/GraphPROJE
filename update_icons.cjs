const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/alper/OneDrive/Desktop/alperene ait/physxplorer3d/physxplorer3d/src';
const files = [
  'CollisionMomentum.jsx',
  'FallingCubes.jsx',
  'ForceVectors.jsx',
  'InclinedPlane.jsx',
  'OpticsSimulation.jsx',
  'ProjectileMotion.jsx',
  'HarmonicMotion.jsx'
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import if not exists
    if (!content.includes('LightBulbIcon')) {
      content = content.replace(
        "import * as THREE",
        "import { LightBulbIcon } from './Icons'\nimport * as THREE"
      );
    }
    
    // Replace emoji
    content = content.replace(/>\s*☀️\s*<\/button>/g, '><LightBulbIcon width={24} height={24} fill={lightPanelOpen ? "#000" : "#fff"} /></button>');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + file);
  }
});
