'use client'

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Mail, Phone, BookOpen, GraduationCap, Code, Globe, Camera } from 'lucide-react' // updated icons
import { addDoc, collection } from "firebase/firestore"
import { db } from "@/config/firebase"

const AssignmentSubmissionForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "", 
    number: "",
    branch: "",
    year: "",
    githubLink: "",
    projectLink: "",
    instagramLink: "",
    timeSubmitted: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submissionTime = new Date().toISOString();
    const dataToSubmit = { ...formData, timeSubmitted: submissionTime };
    console.log(dataToSubmit);
    try {
      await addDoc(collection(db, "AssignmentSubmissions"), dataToSubmit);
      setFormData({
        name: "",
        email: "",
        number: "",
        branch: "",
        year: "",
        githubLink: "",
        projectLink: "",
        instagramLink: "",
        timeSubmitted: "",
      });
      alert("Assignment submitted successfully!");
    } catch (error) {
      console.error("Error submitting data:", error);
      alert("Failed to submit assignment. Please try again.");
    }
  };

  return (
    <Card className="w-full max-w-2xl bg-white dark:bg-[#020817] shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Assignment Submission</CardTitle>
        <CardDescription>Please fill in your details to submit your assignment.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Personal Information */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="number" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-500" />
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="number"
                name="number"
                type="tel"
                value={formData.number}
                onChange={handleChange}
                required
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          {/* Academic Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="branch" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                Branch <span className="text-red-500">*</span>
              </Label>
              <Select name="branch" onValueChange={(value) => handleSelectChange(value, 'branch')} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI&DS">AI&DS</SelectItem>
                  <SelectItem value="CHEM">CHEM</SelectItem>
                  <SelectItem value="COMPS">COMPS</SelectItem>
                  <SelectItem value="EXTC">EXTC</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-500" />
                Year <span className="text-red-500">*</span>
              </Label>
              <Select name="year" onValueChange={(value) => handleSelectChange(value, 'year')} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FE">FE</SelectItem>
                  <SelectItem value="SE">SE</SelectItem>
                  <SelectItem value="TE">TE</SelectItem>
                  <SelectItem value="BE">BE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project Links */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="githubLink" className="flex items-center gap-2">
                <Code className="h-4 w-4 text-blue-500" />
                GitHub Repository Link <span className="text-red-500">*</span>
              </Label>
              <Input
                id="githubLink"
                name="githubLink"
                type="url"
                value={formData.githubLink}
                onChange={handleChange}
                required
                placeholder="https://github.com/username/repository"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectLink" className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                Project Hosted Link <span className="text-red-500">*</span>
              </Label>
              <Input
                id="projectLink"
                name="projectLink"
                type="url"
                value={formData.projectLink}
                onChange={handleChange}
                required
                placeholder="https://your-project.vercel.app"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagramLink" className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-500" />
                Instagram Profile Link <span className="text-red-500">*</span>
              </Label>
              <Input
                id="instagramLink"
                name="instagramLink"
                type="url"
                value={formData.instagramLink}
                onChange={handleChange}
                required
                placeholder="https://instagram.com/username"
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button 
          type="submit" 
          onClick={handleSubmit}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        >
          Submit Assignment
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AssignmentSubmissionForm;
