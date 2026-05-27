"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, ChevronLeft, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/lib/currency";

// Custom designs are a fixed price in USD cents; we run them through
// formatPrice so the visible amount matches the active currency / locale.
const CUSTOM_DESIGN_PRICE_CENTS = 10000;

const AVAILABLE_COLORS = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Navy", hex: "#001F3F" },
  { name: "Gray", hex: "#808080" },
  { name: "Forest Green", hex: "#228B22" },
];

const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const HOODIE_TYPES = [
  { value: "pullover", label: "Pullover Hoodie", description: "Classic pullover with kangaroo pocket" },
  { value: "zip-up", label: "Zip-Up Hoodie", description: "Full-zip front closure" },
  { value: "sleeveless", label: "Sleeveless Hoodie", description: "Vest-style with hood" },
];

export default function CustomDesignerPage() {
  const { formatPrice } = useCurrency();
  const priceLabel = formatPrice(CUSTOM_DESIGN_PRICE_CENTS);

  const [inputType, setInputType] = useState<"text" | "image">("text");
  const [description, setDescription] = useState("");
  const [baseColor, setBaseColor] = useState("Black");
  const [hoodieType, setHoodieType] = useState("pullover");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedDesign, setGeneratedDesign] = useState<{
    id: string;
    imageUrl: string;
    prompt: string;
  } | null>(null);
  const [refinementFeedback, setRefinementFeedback] = useState("");
  const [selectedSize, setSelectedSize] = useState("M");

  const generateMutation = trpc.customDesigns.generate.useMutation({
    onSuccess: (data) => {
      if (data.success && data.design) {
        setGeneratedDesign(data.design);
        setDescription(""); // Clear input after generation
      }
    },
  });

  const refineMutation = trpc.customDesigns.refine.useMutation({
    onSuccess: (data) => {
      if (data.success && data.design) {
        setGeneratedDesign(data.design);
        setRefinementFeedback(""); // Clear feedback after refinement
      }
    },
  });

  const addToCartMutation = trpc.customDesigns.addToCart.useMutation({
    onSuccess: () => {
      // Invalidate cart query to refresh cart count
      window.location.href = "/cart";
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5MB");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = () => {
    if (inputType === "text" && !description.trim()) {
      return;
    }

    if (inputType === "image" && !uploadedImage) {
      return;
    }

    generateMutation.mutate({
      type: inputType,
      description: inputType === "text" ? description : undefined,
      imageData: inputType === "image" && uploadedImage ? uploadedImage : undefined,
      baseColor,
      hoodieType,
    });
  };

  const handleRefine = () => {
    if (!generatedDesign || !refinementFeedback.trim()) {
      return;
    }

    refineMutation.mutate({
      generationId: generatedDesign.id,
      feedback: refinementFeedback,
    });
  };

  const handleAddToCart = () => {
    if (!generatedDesign) return;

    addToCartMutation.mutate({
      designId: generatedDesign.id,
      size: selectedSize,
    });
  };

  const isGenerating = generateMutation.isPending || refineMutation.isPending;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <Link
            href="/products"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Products
          </Link>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Design Your Custom Hoodie
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Create a unique hoodie design using AI • Fixed price: {priceLabel}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Input */}
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold mb-4">Design Input</h2>

              {/* Input Type Tabs */}
              <Tabs value={inputType} onValueChange={(v) => setInputType(v as "text" | "image")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">Describe Design</TabsTrigger>
                  <TabsTrigger value="image">
                    Upload Image
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Design Description</p>
                    <Textarea
                      id="description"
                      placeholder="Describe your dream hoodie design... e.g., 'Mountain sunset with geometric patterns in orange and purple'"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Be specific about colors, patterns, themes, and placement
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="image" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    {uploadedImage ? (
                      <div className="space-y-4">
                        <div className="relative w-full max-w-xs mx-auto aspect-square bg-secondary rounded-lg overflow-hidden">
                          <Image
                            src={uploadedImage}
                            alt="Uploaded design"
                            fill
                            className="object-contain"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUploadedImage(null)}
                        >
                          Remove Image
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm font-medium mb-2">
                          Upload your design
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          PNG, JPG up to 5MB
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="image-upload"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('image-upload')?.click()}
                        >
                          Choose Image
                        </Button>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Hoodie Type Selection */}
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">Hoodie Type</p>
                <Select value={hoodieType} onValueChange={setHoodieType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOODIE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs text-muted-foreground">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Base Color Selection */}
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">Base Hoodie Color</p>
                <Select value={baseColor} onValueChange={setBaseColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color.name} value={color.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span>{color.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || (inputType === "text" && !description.trim()) || (inputType === "image" && !uploadedImage)}
                className="w-full mt-6"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Design...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Design
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: Preview & Actions */}
          <div className="space-y-6">
            {generatedDesign ? (
              <>
                {/* Design Preview & Add to Cart - Combined */}
                <div className="rounded-lg border bg-gradient-to-br from-card to-secondary/20 shadow-sm overflow-hidden">
                  {/* Design Preview */}
                  <div className="p-6 pb-4">
                    <h2 className="text-xl font-semibold mb-4">Your Design</h2>

                    <div className="aspect-square relative bg-secondary rounded-lg mb-4">
                      <Image
                        src={generatedDesign.imageUrl}
                        alt="Custom Design"
                        fill
                        className="object-contain p-8"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          e.currentTarget.src = "/images/placeholder-hoodie.png";
                        }}
                      />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-muted-foreground mb-1">AI Prompt Used:</p>
                      <p className="text-sm">{generatedDesign.prompt}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/50" />

                  {/* Add to Cart Section */}
                  <div className="p-6 pt-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="text-3xl font-bold mb-1">{priceLabel}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span>One of a Kind</span>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        Custom Design
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <p className="text-sm font-medium mb-2">Select Size</p>
                        <Select value={selectedSize} onValueChange={setSelectedSize}>
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_SIZES.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span>AI-Generated Design</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span>Premium Cotton Blend</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span>Ships in 5-7 business days</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleAddToCart}
                      disabled={addToCartMutation.isPending}
                      className="w-full h-12"
                      size="lg"
                    >
                      {addToCartMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Adding to Cart...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-5 w-5" />
                          Add to Cart
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border bg-card p-12 text-center">
                <Sparkles className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Design Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Enter a description and click "Generate Design" to create your custom hoodie
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
