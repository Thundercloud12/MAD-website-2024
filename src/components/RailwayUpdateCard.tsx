import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import "@/app/globals.css";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { branches } from "@/constants/branches";
import useGradYear from "@/constants/gradYearList";
import { Textarea } from "@/components/ui/textarea";
import { travelFromLocations } from "@/constants/travelFromLocations";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { dateFormat } from "@/constants/dateFormat";
import { Check, X } from 'lucide-react';
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
  uploadString,
} from "firebase/storage";

const RailwayUpdateCard = ({
  formSchema,
  passData,
}: {
  formSchema: any;
  passData: any;
}) => {
  const [isEditable, setIsEditable] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const gradYearList = useGradYear();
  const { toast } = useToast();
  const { control } = useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: passData,
  });

  const toggleEditMode = () => {
    if (!isEditable) {
      toast({
        description: "You can edit now",
      });
    }
    setIsEditable(!isEditable);
  };

  const extractRequiredFields = (schema: any) => {
    const requiredFields = [];

    for (const key in schema.shape) {
      const field = schema.shape[key];
      if (
        !(field instanceof z.ZodOptional) &&
        !(field instanceof z.ZodNullable)
      ) {
        requiredFields.push(key);
      }
    }
    return requiredFields;
  };
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const studentId = values.uid;
      const requiredFields = extractRequiredFields(formSchema);
      const emptyFields = requiredFields.filter(
        (field) =>
          !values[field] ||
          (typeof values[field] === "string" && values[field].trim() === "")
      );

      if (emptyFields.length > 0) {
        // Display error toast if any required field is empty
        toast({
          description: `Please fill out all required fields (${emptyFields.join(
            ", "
          )})`,
          variant: "destructive",
        });
        return; // Exit early, do not submit
      }

      // Validate phone number to contain only digits
      const phoneNumPattern = /^\d{10}$/;
      if (!phoneNumPattern.test(values.phoneNum)) {
        toast({
          description: "Phone Number is not valid",
          variant: "destructive",
        });
        setIsEditable(true);
        return; // Exit early, do not submit
      }

      const { doi, phoneNum, uid, lastPassIssued, certNo, ...formData } =
        values;
      const newData = {
        ...formData,
        lastPassIssued: values.doi,
        phoneNum: parseInt(values.phoneNum, 10),
      };

      const newReqData = {
        passCollected: {
          collected: "1",
          date: new Date(),
        },
      };

      const concessionRef = doc(db, "ConcessionDetails", studentId);
      await updateDoc(concessionRef, newData);
      const concessionReqRef = doc(db, "ConcessionRequest", studentId);
      await updateDoc(concessionReqRef, newReqData);

      // For Stats UPDATE PASS
      const concessionHistoryRef = doc(db, "ConcessionHistory", "DailyStats");
      const concessionHistorySnap = await getDoc(concessionHistoryRef);
      const currentDate = dateFormat(new Date())
  
      if (concessionHistorySnap.exists()) {
        const historyData = concessionHistorySnap.data();
        let statsArray = historyData.stats || [];
        const dateIndex = statsArray.findIndex((entry: any) => entry.date === currentDate);
  
        if (dateIndex >= 0) {
          if (typeof statsArray[dateIndex].updatedPass !== 'number') {
            statsArray[dateIndex].updatedPass = 0;
          }
          statsArray[dateIndex].updatedPass += 1;
        } else {
          statsArray.push({
            date: currentDate,
            updatedPass: 1,
          });
        }
  
        await updateDoc(concessionHistoryRef, { stats: statsArray });
      } else {
        await setDoc(concessionHistoryRef, {
          stats: [{
            date: currentDate,
            updatedPass: 1,
          }],
        });
      }

      toast({ description: "Document updated successfully!" });
    } catch (error) {
      toast({
        description: "An error occurred",
        variant: "destructive",
      });
      console.error("Error ", error);
    } finally {
      setIsEditable(false);
      setLoading(false);
    }
  };

  const cancelForm = async () => {
    setLoading(true);

    const storage = getStorage();
    const fileRef = storageRef(storage, "RailwayConcession/concessionHistory.json");

    try {
      const concessionRef = doc(db, "ConcessionDetails", passData.uid);
      await updateDoc(concessionRef, {
        status: "rejected",
        statusMessage: statusMessage || "Your form has been cancelled",
      });

      const concessionReqRef = doc(db, "ConcessionRequest", passData.uid);
      await updateDoc(concessionReqRef, {
        status: "rejected",
        statusMessage: statusMessage || "Your form has been cancelled",
        passCollected: null,
      });

      // Update history array in concessionHistory
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const existingData = await response.json();

      const history: any[] = Array.isArray(existingData) ? existingData : [];

      let updated = false;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].passNum === passData.certNo) {
          history[i].status = "cancelled";
          updated = true;
          break;
        }
      }

      if (updated) {
        await uploadString(fileRef, JSON.stringify(history, null, 2), "raw", {
          contentType: "application/json",
        });
        console.log("Status updated in concessionHistory.json");
      } else {
        console.error("Pass number not found in history.");
      }

      // For Stats UPDATE PASS
      const concessionHistoryRef = doc(db, "ConcessionHistory", "DailyStats");
      const concessionHistorySnap = await getDoc(concessionHistoryRef);
      const currentDate = dateFormat(new Date());
  
      if (concessionHistorySnap.exists()) {
        const historyData = concessionHistorySnap.data();
        let statsArray = historyData.stats || [];
        const dateIndex = statsArray.findIndex((entry: any) => entry.date === currentDate);
  
        if (dateIndex >= 0) {
          if (typeof statsArray[dateIndex].cancelledPass !== 'number') {
            statsArray[dateIndex].cancelledPass = 0;
          }
          statsArray[dateIndex].cancelledPass += 1;
        } else {
          statsArray.push({
            date: currentDate,
            cancelledPass: 1,
          });
        }
  
        await updateDoc(concessionHistoryRef, { stats: statsArray });
      } else {
        await setDoc(concessionHistoryRef, {
          stats: [{
            date: currentDate,
            cancelledPass: 1
          }],
        });
      }

    toast({ description: "Pass Deleted Successfully !" });
    } catch (error) {
      console.error("Error ", error);
    } finally {
      setIsEditable(false);
      setLoading(false);
    }

    
  };

  // const cancelForm = async () => {
  //   try {
  //     // Update ConcessionDetails
  //     const concessionRef = doc(db, "ConcessionDetails", passData.uid);
  //     await updateDoc(concessionRef, {
  //       status: "rejected",
  //       statusMessage: statusMessage || "Your form has been cancelled",
  //     });

  //     // Update ConcessionRequest
  //     const concessionReqRef = doc(db, "ConcessionRequest", passData.uid);
  //     await updateDoc(concessionReqRef, {
  //       status: "rejected",
  //       statusMessage: statusMessage || "Your form has been cancelled",
  //       passCollected: null,
  //     });

  //     // Update history array in concessionHistory
  //     const historyRef = doc(db, "concessionHistory", "History");
  //     const historySnap = await getDoc(historyRef);

  //     if (historySnap.exists()) {
  //       let history = historySnap.data().history as { passNum: string; status: string }[];
  //       const passIndex = history.findIndex((entry) => entry.passNum === "Z123");

  //       if (passIndex !== -1) {
  //         history[passIndex].status = "cancelled";

  //         await updateDoc(historyRef, {
  //           history: history,
  //         });
  //       } else {
  //         console.error("Pass number not found in history.");
  //       }
  //     } else {
  //       console.error("History document does not exist.");
  //     }

  //   } catch (error) {
  //     console.error("Error ", error);
  //   }

  //   setIsEditable(false);
  //   setLoading(false);
  // };

  const handleSave = (message: string) => {
    setIsModalOpen(false);
    setIsDialogOpen(false);
    setStatusMessage(message);
    cancelForm();
    handleCancel();
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setIsModalOpen(false);
  };

  return (
    <>

      {loading ? (
        <div className="flex justify-center items-center h-screen">
          <Loader className="w-10 h-10 animate-spin" />
        </div>
      ) : (
        <Card className="mx-auto ml-[1%] shadow-box mt-2">
        <CardContent className="p-6">
          <Form {...form}>
            <form method="post" className="space-y-8">
              <div className="grid gap-4 ">
                {/* Heading */}
                <div className="card-head-wrapper w-full  flex justify-between items-center">
                  <div className="flex gap-2 w-[55%]">
                    {" "}
                    <div className="grid gap-2 ">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input
                                // className="shadow-box"
                                {...field}
                                readOnly={!isEditable}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />{" "}
                    </div>{" "}
                    <div className="grid gap-2">
                      <FormField
                        control={form.control}
                        name="middleName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Middle Name</FormLabel>
                            <FormControl>
                              <Input readOnly={!isEditable} {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>{" "}
                    <div className="grid gap-2">
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input readOnly={!isEditable} {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>{" "}
                  <div>
                    <div className="grid gap-2">
                      <FormField
                        control={form.control}
                        name="certNo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Certifcate Number</FormLabel>
                            <FormControl>
                            <Input
                                className="cursor-default"
                                value={field.value}
                                disabled
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>{" "}
                  </div>
                </div>{" "}
                <div className="card-other-details flex justify-between">
                  {/* Other Details */}
                  <div className="personal-details gap-6">
                    <div className="grid grid-cols-3 gap-2 w-full mb-2">
                      <div className="grid gap-2">
                        {" "}
                        <FormField
                          control={form.control}
                          name="gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gender</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={(newValue) => {
                                  if (isEditable) {
                                    // Update the field value with newValue
                                    field.onChange(newValue);
                                  }
                                }}
                                disabled={!isEditable}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Male">Male</SelectItem>
                                  <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />{" "}
                      </div>{" "}
                      <div className="grid gap-2">
                        <FormField
                          control={form.control}
                          name="dob"
                          render={({ field }) => (
                            <FormItem className="">
                              <FormLabel>Date of Birth</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl className="flex items-center justify-center">
                                    <Button
                                      variant={"outline-solid"}
                                      onClick={() => {
                                       // console.log(format(field.value, "PPP"));
                                      }}
                                      className={cn(
                                        "text-center font-normal",
                                        !field.value && "text-muted-foreground",
                                        !isEditable
                                          ? "opacity-50"
                                          : "opacity-100"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>

                                {isEditable && (
                                  <PopoverContent
                                    className="w-auto p-0"
                                    align="start"
                                  >
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      defaultMonth={field.value}
                                      onSelect={
                                        field.onChange
                                        // Handle selecting date here if needed
                                      }
                                      disabled={(date) =>
                                        date > new Date() ||
                                        date < new Date("2000-01-01")
                                      }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                )}
                              </Popover>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>{" "}
                      <div className="grid gap-2">
                        <FormField
                          control={form.control}
                          name="doi"
                          render={({ field }) => (
                            <FormItem className="">
                              <FormLabel>Date of Issue</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl className="flex items-center justify-center">
                                    <Button
                                      variant={"outline-solid"}
                                      onClick={() => {
                                        // console.log(format(field.value, "PPP"));
                                      }}
                                      className={cn(
                                        "text-center font-normal",
                                        !field.value && "text-muted-foreground",
                                        !isEditable
                                          ? "opacity-50"
                                          : "opacity-100"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>

                                {isEditable && (
                                  <PopoverContent
                                    className="w-auto p-0"
                                    align="start"
                                  >
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      defaultMonth={field.value}
                                      onSelect={
                                        field.onChange
                                        // Handle selecting date here if needed
                                      }
                                      disabled={(date) => date < new Date()}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                )}
                              </Popover>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-[80%] mb-2">
                      <div className="grid gap-2">
                        <FormField
                          control={form.control}
                          name="branch"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Branch</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={!isEditable}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select branch" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {branches.map((branch, index) => {
                                    return (
                                      <SelectItem key={index} value={branch}>
                                        {branch}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />{" "}
                      </div>{" "}
                      <div className="grid gap-2">
                        <FormField
                          control={form.control}
                          name="gradyear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Graduation Year</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={!isEditable}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select grad year" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {gradYearList.map((year, index) => {
                                    return (
                                      <SelectItem
                                        key={index}
                                        value={year.gradYear}
                                      >
                                        {year.year}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />{" "}
                      </div>
                    </div>{" "}
                    <div className="grid gap-2 w-[50%] mb-2">
                      <FormField
                        control={form.control}
                        name="phoneNum"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                pattern="[0-9]*"
                                readOnly={!isEditable}
                                {...field}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>{" "}
                    <div className="grid gap-2">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Textarea
                                readOnly={!isEditable}
                                {...field}
                                className="resize-none"
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Rail Details Section */}
                  <div className="rail-details w-[40%] flex flex-col  justify-between	">
                    {/* Concession Details Section */}
                    <div>
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div className="grid gap-2">
                          {" "}
                          <FormField
                            control={form.control}
                            name="from"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>From</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  disabled={!isEditable}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {travelFromLocations.map(
                                      (location, index) => (
                                        <SelectItem
                                          key={index}
                                          value={location}
                                        >
                                          {location}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>

                                <FormMessage />
                              </FormItem>
                            )}
                          />{" "}
                        </div>
                        <div className="grid gap-2">
                          {" "}
                          <FormField
                            control={form.control}
                            name="to"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>To</FormLabel>
                                <FormControl>
                                  <Input
                                    className="cursor-default"
                                    value={field.value}
                                    disabled
                                  />
                                </FormControl>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>{" "}
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div className="grid gap-2">
                          {" "}
                          <FormField
                            control={form.control}
                            name="class"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Class</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  disabled={!isEditable}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="I">I</SelectItem>
                                    <SelectItem value="II">II</SelectItem>
                                  </SelectContent>
                                </Select>

                                <FormMessage />
                              </FormItem>
                            )}
                          />{" "}
                        </div>{" "}
                        <div className="grid gap-2">
                          {" "}
                          <FormField
                            control={form.control}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Duration</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  disabled={!isEditable}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Monthly">
                                      Monthly
                                    </SelectItem>
                                    <SelectItem value="Quarterly">
                                      Quarterly
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>{" "}
                      <div className="grid gap-2 disabled:cursor-pointer">
                        <FormField
                          control={form.control}
                          name="travelLane"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Travel lane</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={!isEditable}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Western">
                                    Western
                                  </SelectItem>
                                  <SelectItem value="Central">
                                    Central
                                  </SelectItem>
                                  <SelectItem value="Harbour">
                                    Harbour
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />{" "}
                      </div>{" "}
                    </div>

                    {/* Buttons */}
                    <div className="buttons w-full flex justify-end space-x-4">
                        {/* Edit / Save Button */}
                        <Button
                          type="button"
                          onClick={toggleEditMode}
                          className={`bg-green-500 text-white py-2 px-4 rounded-lg shadow transition duration-300 flex items-center 
                            hover:bg-green-600 focus:outline-hidden focus:ring-2 focus:ring-green-400 focus:ring-opacity-50 
                            ${isEditable ? 'cursor-pointer' : 'cursor-default'}`}
                
                        >
                          {isEditable ? (
                            <span
                              onClick={(e) => {
                                e.preventDefault();
                                onSubmit(form.getValues());
                              }}
                              className="flex items-center space-x-1" 
                            >
                              <Check className="h-5 w-5" aria-hidden="true" />
                              <span className="font-semibold">Save</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1">
                              <span className="font-semibold">Edit Details</span>
                            </span>
                          )}
                        </Button>


                        {/* Close Button when in Editable Mode */}
                        {isEditable && (
                          <Button
                            type="button"
                            onClick={toggleEditMode}
                            className="bg-red-500 text-white py-2 rounded-lg shadow-sm hover:bg-red-600 transition duration-300 flex items-center"
                          >
                            <X className="h-5 w-5 mr-2" /> {/* X icon */}
                            Close
                          </Button>
                        )}

                        {/* Delete Button when not in Editable Mode */}
                        {!isEditable && (
                          <Button
                            type="button"
                            onClick={() => {
                              setIsDialogOpen(true);
                              setIsModalOpen(true);
                            }}
                            className="bg-red-500 text-white py-2 rounded-lg shadow-sm hover:bg-red-600 transition duration-300"
                          >
                            {/* Delete */}
                            Cancel Pass
                          </Button>
                        )}
                      </div>

                  </div>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
        </Card>
      )}
      
      {isModalOpen ? (
        <div className="fixed inset-0 flex items-center z-100 justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg flex flex-col justify-between h-[40vh] w-[50vw] max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-200 mb-4">
              Delete Pass
            </h2>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="Enter Reason for Cancellation"
              className="border border-gray-300 dark:border-gray-700 rounded-lg w-full p-3 mb-4 focus:border-blue-400 focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => handleSave(statusMessage)}
                className="bg-red-500 text-white px-5 py-3 rounded-lg shadow-sm hover:bg-red-600 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              >
                Delete Pass
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-100 text-gray-800 px-5 py-3 rounded-lg shadow-sm hover:bg-gray-400 focus:outline-hidden focus:ring-2 focus:ring-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
export default RailwayUpdateCard;
