const fs = require('fs');

console.log('Finding syntax error in message (4).js...');

try {
    const code = fs.readFileSync('./message (4).js', 'utf8');
    const lines = code.split('\n');
    
    // Try to find the problematic area by testing chunks
    let startLine = 1;
    let chunkSize = 100;
    let errorLine = null;
    
    for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(0, i + chunkSize).join('\n');
        try {
            new Function(chunk);
        } catch (error) {
            // Error found in this chunk, narrow it down
            console.log(`Error found between lines ${i + 1} and ${i + chunkSize}`);
            
            // Binary search to find exact line
            let low = i;
            let high = Math.min(i + chunkSize, lines.length);
            
            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                const testChunk = lines.slice(0, mid + 1).join('\n');
                
                try {
                    new Function(testChunk);
                    low = mid + 1;
                } catch (e) {
                    high = mid;
                }
            }
            
            errorLine = low + 1;
            console.log(`❌ Syntax error at line ${errorLine}:`);
            console.log(`Line content: "${lines[low]}"`);
            
            // Show context (5 lines before and after)
            const start = Math.max(0, low - 5);
            const end = Math.min(lines.length, low + 6);
            
            console.log('\n--- Context ---');
            for (let j = start; j < end; j++) {
                const marker = j === low ? '>>> ' : '    ';
                console.log(`${marker}${j + 1}: ${lines[j]}`);
            }
            break;
        }
    }
    
    if (!errorLine) {
        console.log('❓ No syntax error found in file chunks. Checking full file...');
        try {
            new Function(code);
            console.log('✅ Full file syntax is valid');
        } catch (error) {
            console.error('❌ Full file syntax error:', error.message);
        }
    }
    
} catch (error) {
    console.error('Error reading file:', error.message);
}
