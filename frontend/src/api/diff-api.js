#!/usr/bin/env node
/**
 * 对比两个 OpenAPI JSON 文档，输出精简变更摘要。
 * 用法：node diff-api.js <旧文档> <新文档>
 * 默认：node diff-api.js api文档2.json api文档.json
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const oldPath = process.argv[2] ?? resolve(__dir, 'api文档.json')
const newPath = process.argv[3] ?? resolve(__dir, 'api文档latest.json')

const oldDoc = JSON.parse(readFileSync(oldPath, 'utf8'))
const newDoc = JSON.parse(readFileSync(newPath, 'utf8'))

// ─── helpers ────────────────────────────────────────────────────────────────

function flattenPaths(doc) {
  const result = {}
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (method === 'parameters') continue
      result[`${method.toUpperCase()} ${path}`] = op
    }
  }
  return result
}

function getSchema(doc, ref) {
  if (!ref?.startsWith('#/')) return null
  const parts = ref.slice(2).split('/')
  let cur = doc
  for (const p of parts) cur = cur?.[p]
  return cur ?? null
}

function resolveSchema(doc, schemaOrRef) {
  if (!schemaOrRef) return null
  if (schemaOrRef.$ref) return getSchema(doc, schemaOrRef.$ref)
  return schemaOrRef
}

function schemaFields(doc, schemaOrRef, depth = 0) {
  if (depth > 3) return {}
  const schema = resolveSchema(doc, schemaOrRef)
  if (!schema) return {}
  const fields = {}
  if (schema.properties) {
    for (const [k, v] of Object.entries(schema.properties)) {
      const resolved = resolveSchema(doc, v)
      fields[k] = resolved?.type ?? (v.$ref ? v.$ref.split('/').pop() : 'unknown')
    }
  }
  if (schema.allOf || schema.anyOf || schema.oneOf) {
    const list = schema.allOf ?? schema.anyOf ?? schema.oneOf
    for (const item of list) {
      Object.assign(fields, schemaFields(doc, item, depth + 1))
    }
  }
  return fields
}

function requestBodyFields(doc, op) {
  const content = op?.requestBody?.content
  if (!content) return null
  const schema = content['application/json']?.schema ?? Object.values(content)[0]?.schema
  return schemaFields(doc, schema)
}

function responseFields(doc, op) {
  const schema = op?.responses?.['200']?.content?.['application/json']?.schema
  return schema ? schemaFields(doc, schema) : null
}

function diffFields(oldF, newF) {
  if (!oldF && !newF) return null
  if (!oldF) return { added: Object.keys(newF), removed: [], changed: [] }
  if (!newF) return { added: [], removed: Object.keys(oldF), changed: [] }
  const added = Object.keys(newF).filter(k => !(k in oldF))
  const removed = Object.keys(oldF).filter(k => !(k in newF))
  const changed = Object.keys(newF).filter(k => k in oldF && oldF[k] !== newF[k])
  return { added, removed, changed }
}

function fieldDiffLine(label, diff) {
  if (!diff) return null
  const parts = []
  if (diff.added.length) parts.push(`+[${diff.added.join(', ')}]`)
  if (diff.removed.length) parts.push(`-[${diff.removed.join(', ')}]`)
  if (diff.changed.length) parts.push(`~[${diff.changed.join(', ')}]`)
  if (!parts.length) return null
  return `    ${label}: ${parts.join(' ')}`
}

// ─── diff ────────────────────────────────────────────────────────────────────

const oldPaths = flattenPaths(oldDoc)
const newPaths = flattenPaths(newDoc)

const added = []
const removed = []
const modified = []

for (const key of Object.keys(newPaths)) {
  if (!(key in oldPaths)) {
    added.push(key)
  } else {
    const oldOp = oldPaths[key]
    const newOp = newPaths[key]

    const lines = []

    // summary change
    if (oldOp.summary !== newOp.summary) {
      lines.push(`    summary: "${oldOp.summary}" → "${newOp.summary}"`)
    }

    // request body fields
    const reqDiff = diffFields(
      requestBodyFields(oldDoc, oldOp),
      requestBodyFields(newDoc, newOp)
    )
    const reqLine = fieldDiffLine('req', reqDiff)
    if (reqLine) lines.push(reqLine)

    // response fields
    const resDiff = diffFields(
      responseFields(oldDoc, oldOp),
      responseFields(newDoc, newOp)
    )
    const resLine = fieldDiffLine('res', resDiff)
    if (resLine) lines.push(resLine)

    if (lines.length) modified.push({ key, lines })
  }
}

for (const key of Object.keys(oldPaths)) {
  if (!(key in newPaths)) removed.push(key)
}

// ─── output ──────────────────────────────────────────────────────────────────

const OLD_LABEL = oldPath.split('/').pop()
const NEW_LABEL = newPath.split('/').pop()

console.log(`\n📄 ${OLD_LABEL}  →  ${NEW_LABEL}\n`)

if (added.length) {
  console.log(`✅ 新增接口 (${added.length})`)
  added.forEach(k => console.log(`   ${k}`))
  console.log()
}

if (removed.length) {
  console.log(`🗑  删除接口 (${removed.length})`)
  removed.forEach(k => console.log(`   ${k}`))
  console.log()
}

if (modified.length) {
  console.log(`✏️  字段变更 (${modified.length})`)
  modified.forEach(({ key, lines }) => {
    console.log(`   ${key}`)
    lines.forEach(l => console.log(l))
  })
  console.log()
}

if (!added.length && !removed.length && !modified.length) {
  console.log('✅ 无差异')
}
