#!/usr/bin/env node
/**
 * 从根目录 Userscript 元数据生成 index.json
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REPO = 'ZHBlue5/heytea-script'
const BRANCH = 'main'
const INDEX_PATH = join(ROOT, 'index.json')

const SECRET_PATTERNS = [
    /(?:password|passwd|api[_-]?key|secret|access[_-]?token)\s*[:=]\s*['"][^'"]{4,}['"]/i,
]

function parseUserscriptMeta(content) {
    const block = content.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)
    if (!block) throw new Error('缺少 ==UserScript== 块')
    const lines = block[1].split('\n')
    const meta = {}
    for (const line of lines) {
        const m = line.match(/^\s*\/\/\s*@(\w[\w-]*)\s+(.*)$/)
        if (!m) continue
        const key = m[1].toLowerCase()
        const val = m[2].trim()
        if (meta[key] === undefined) meta[key] = val
        else if (Array.isArray(meta[key])) meta[key].push(val)
        else meta[key] = [meta[key], val]
    }
    if (!meta.name) throw new Error('@name 必填')
    return {
        name: meta.name,
        description: meta.description,
        version: meta.version,
    }
}

function scanSecrets(filename, content) {
    const body = content.replace(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/, '')
    for (const re of SECRET_PATTERNS) {
        const hit = body.match(re)
        if (hit) {
            throw new Error(`${filename}: 疑似硬编码凭据 — ${hit[0].slice(0, 60)}…`)
        }
    }
}

function rawUrl(filename) {
    return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${filename}`
}

async function buildIndex() {
    const files = (await readdir(ROOT))
        .filter(f => f.endsWith('.js'))
        .sort()

    const scripts = []
    for (const file of files) {
        const content = await readFile(join(ROOT, file), 'utf8')
        scanSecrets(file, content)
        const meta = parseUserscriptMeta(content)
        const id = file.replace(/\.js$/, '')
        scripts.push({
            id,
            name: meta.name,
            ...(meta.description ? { description: meta.description } : {}),
            url: rawUrl(file),
            ...(meta.version ? { version: meta.version } : {}),
        })
    }
    scripts.sort((a, b) => a.id.localeCompare(b.id))
    return { version: 1, scripts }
}

function stableStringify(obj) {
    return JSON.stringify(obj, null, 2) + '\n'
}

async function main() {
    const check = process.argv.includes('--check')
    const index = await buildIndex()

    if (check) {
        let existing
        try {
            existing = await readFile(INDEX_PATH, 'utf8')
        } catch {
            console.error('index.json 不存在，请先运行 npm run generate-index')
            process.exit(1)
        }
        if (existing !== stableStringify(index)) {
            console.error('index.json 与脚本元数据不一致，请运行 npm run generate-index')
            process.exit(1)
        }
        console.log(`check-index OK (${index.scripts.length} scripts)`)
        return
    }

    await writeFile(INDEX_PATH, stableStringify(index))
    console.log(`Wrote index.json (${index.scripts.length} scripts)`)
}

main().catch(err => {
    console.error(err.message || err)
    process.exit(1)
})
