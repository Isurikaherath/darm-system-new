// src/pages/Documents.tsx
import React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { documents, type DocumentRecord } from "@/data/documents";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">All Documents in Your Department</h1>
      {documents.length === 0 ? (
        <p className="text-muted-foreground">No documents.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registration Date</TableHead>
              <TableHead>Document Name</TableHead>
              <TableHead>Document Number</TableHead>
              <TableHead>Cart Number</TableHead>
              <TableHead>File Number</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Retention Period</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc: DocumentRecord, idx) => (
              <TableRow key={idx}>
                <TableCell>{doc.registrationDate}</TableCell>
                <TableCell>{doc.name}</TableCell>
                <TableCell>{doc.number}</TableCell>
                <TableCell>{doc.cartNumber}</TableCell>
                <TableCell>{doc.fileNumber ?? "-"}</TableCell>
                <TableCell>{doc.fileName ?? "-"}</TableCell>
                <TableCell>{doc.retentionPeriod}</TableCell>
                <TableCell>{doc.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
