import fs from 'fs';
import path from 'path';

// If sharp is available, use sharp; otherwise copy / convert
async function generateIcons() {
  const iconSrc = path.resolve('public', 'icon2.png');
  const resDir = path.resolve('android', 'app', 'src', 'main', 'res');

  if (!fs.existsSync(iconSrc)) {
    console.error('Source icon not found:', iconSrc);
    return;
  }

  if (!fs.existsSync(resDir)) {
    console.error('Android res directory not found:', resDir);
    return;
  }

  const sizes = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
  ];

  let sharp;
  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;
  } catch (e) {
    console.log('Sharp not installed, will use fallback copying.');
  }

  for (const item of sizes) {
    const targetFolder = path.join(resDir, item.dir);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    if (sharp) {
      // Generate square icon
      await sharp(iconSrc)
        .resize(item.size, item.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(path.join(targetFolder, 'ic_launcher.png'));

      // Generate round icon
      await sharp(iconSrc)
        .resize(item.size, item.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(path.join(targetFolder, 'ic_launcher_round.png'));

      // Generate foreground icon
      await sharp(iconSrc)
        .resize(item.fgSize, item.fgSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(path.join(targetFolder, 'ic_launcher_foreground.png'));

      console.log(`Generated icons for ${item.dir}`);
    } else {
      // Direct copy fallback
      fs.copyFileSync(iconSrc, path.join(targetFolder, 'ic_launcher.png'));
      fs.copyFileSync(iconSrc, path.join(targetFolder, 'ic_launcher_round.png'));
      fs.copyFileSync(iconSrc, path.join(targetFolder, 'ic_launcher_foreground.png'));
    }
  }

  // Also ensure splash / drawable has the logo
  const drawableDirs = ['drawable', 'drawable-land-hdpi', 'drawable-land-mdpi', 'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi', 'drawable-port-hdpi', 'drawable-port-mdpi', 'drawable-port-xhdpi', 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi'];
  for (const d of drawableDirs) {
    const dPath = path.join(resDir, d);
    if (fs.existsSync(dPath)) {
      fs.copyFileSync(iconSrc, path.join(dPath, 'splash.png'));
    }
  }

  console.log('✅ Android icons successfully injected!');
}

generateIcons().catch(console.error);
