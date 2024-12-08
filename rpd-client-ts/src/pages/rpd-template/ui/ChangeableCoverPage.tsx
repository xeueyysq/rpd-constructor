import {useEffect, useRef, useState} from 'react'
import {Box, Button} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import SaveAltIcon from '@mui/icons-material/SaveAlt'
import {TextareaAutosize as BaseTextareaAutosize} from '@mui/base/TextareaAutosize'
import {styled} from '@mui/system'
import {Loader} from "@shared/ui"
import {axiosBase} from '@shared/api'

interface ChangeableCoverPageProps {
    title: string;
    defaultText?: string;
}

interface ValueData {
    _id: string;
    value: string;
}

// const ChangeableCoverPage = ({ title, defaultText }: ChangeableCoverPageProps) => {
const ChangeableCoverPage = ({title}: ChangeableCoverPageProps) => {
    const [isEditing, setIsEditing] = useState(false)
    const [value, setValue] = useState<ValueData | null>(null) // Typed state
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null) // Explicit type for the ref

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axiosBase.get(`rpd-changeable-values?title=${title}`)
                setValue(response.data)
            } catch (error) {
                console.error(error)
            }
        }

        fetchData()
    }, [title])

    const handleEditClick = () => {
        setIsEditing(true)
    }

    const handleSaveClick = async () => {
        setIsEditing(false)

        if (textAreaRef.current) { // Null check
            const textareaValue = textAreaRef.current.value

            try {
                const response = await axiosBase.put(`rpd-changeable-values/${value?._id}`, {value: textareaValue})
                setValue(response.data)
            } catch (error) {
                console.error(error)
            }
        }
    }

    if (!value) {
        return <Loader/>
    }

    const TextareaAutosize = styled(BaseTextareaAutosize)(() => `
      box-sizing: border-box;
      width: 100%;
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 0.875rem;
      font-weight: 400;
      line-height: 1.5;
      padding: 8px 12px;
      border-radius: 8px;
      color: #1C2025;
      background: #ffffff;
      border: 1px solid #DAE2ED;
      box-shadow: 0px 2px 2px #F3F6F9;

      &:hover {
        border-color: #3399FF;
      }

      &:focus {
        border-color: #3399FF;
        box-shadow: 0 0 0 3px #b6daff;
      }

      &:focus-visible {
        outline: 0;
      }
    `
    )

    return (
        <Box>
            {isEditing ? (
                <Box>
                    <TextareaAutosize
                        ref={textAreaRef}
                        aria-label="empty textarea"
                        placeholder="Empty"
                        id={title}
                        defaultValue={value?.value}
                        sx={{my: 1}}
                    />
                    <Button
                        variant="outlined"
                        size="small"
                        endIcon={<SaveAltIcon color="primary"/>}
                        onClick={handleSaveClick}
                    >
                        сохранить изменения
                    </Button>
                </Box>
            ) : (
                <Box>
                    {value?.value ? (
                        <Box dangerouslySetInnerHTML={{__html: value.value}} sx={{py: 1}}></Box>
                    ) : (
                        <p>No content available</p>
                    )}
                    <Button
                        variant="outlined"
                        size="small"
                        endIcon={<EditIcon color="primary"/>}
                        onClick={handleEditClick}
                    >
                        редактировать
                    </Button>
                </Box>
            )}
        </Box>
    )
}

export default ChangeableCoverPage
