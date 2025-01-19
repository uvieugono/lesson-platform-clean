const fs = require('fs');
const { execSync } = require('child_process');

// List of packages to check
const requiredPackages = [
    'lucide-react',
    'recharts',
    'framer-motion',
    'axios',
    '@radix-ui/react-slot',
    'clsx',
    'tailwind-merge'
];

// Function to check if a package is installed
function isPackageInstalled(packageName) {
    try {
        // Try to require the package
        require.resolve(packageName, { paths: [process.cwd()] });
        return true;
    } catch (e) {
        return false;
    }
}

// Function to check package.json for dependencies
function checkPackageJson() {
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const allDependencies = {
            ...(packageJson.dependencies || {}),
            ...(packageJson.devDependencies || {})
        };
        return allDependencies;
    } catch (e) {
        console.error('Error reading package.json:', e.message);
        return {};
    }
}

// Main check
console.log('Checking dependencies...\n');
const dependencies = checkPackageJson();
const missingPackages = [];
const installedPackages = [];

requiredPackages.forEach(pkg => {
    if (!dependencies[pkg] && !isPackageInstalled(pkg)) {
        missingPackages.push(pkg);
    } else {
        installedPackages.push(pkg);
    }
});

// Print results
console.log('Installed packages:');
installedPackages.forEach(pkg => {
    console.log('✓', pkg);
});

console.log('\nMissing packages:');
missingPackages.forEach(pkg => {
    console.log('✗', pkg);
});

if (missingPackages.length > 0) {
    console.log('\nInstall missing packages with:');
    console.log(`npm install ${missingPackages.join(' ')}`);
}